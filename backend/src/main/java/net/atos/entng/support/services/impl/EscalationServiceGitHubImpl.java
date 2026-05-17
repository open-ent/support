package net.atos.entng.support.services.impl;

import fr.wseduc.webutils.Either;
import fr.wseduc.webutils.Server;
import io.vertx.core.CompositeFuture;
import io.vertx.core.Future;
import io.vertx.core.Handler;
import io.vertx.core.Promise;
import io.vertx.core.Vertx;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.eventbus.EventBus;
import io.vertx.core.eventbus.Message;
import io.vertx.core.http.HttpHeaders;
import io.vertx.core.http.HttpMethod;
import io.vertx.core.http.HttpClientRequest;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.http.RequestOptions;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;
import net.atos.entng.support.Attachment;
import net.atos.entng.support.Comment;
import net.atos.entng.support.Issue;
import net.atos.entng.support.Ticket;
import net.atos.entng.support.enums.BugTracker;
import net.atos.entng.support.enums.TicketHisto;
import net.atos.entng.support.services.EscalationService;
import net.atos.entng.support.services.TicketServiceSql;
import net.atos.entng.support.services.UserService;
import org.entcore.common.bus.WorkspaceHelper;
import org.entcore.common.notification.TimelineHelper;
import org.entcore.common.remote.RemoteClient;
import org.entcore.common.storage.Storage;
import org.entcore.common.user.UserInfos;
import org.entcore.common.utils.Id;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Escalation service implementation using GitHub Issues API.
 * <p>
 * Config keys (in ent-core.yaml, support module section):
 * <ul>
 *   <li>{@code github_token}             — GitHub personal access token (repo scope)</li>
 *   <li>{@code github_owner}             — org/user owning the target repo</li>
 *   <li>{@code github_repo}              — repository name</li>
 *   <li>{@code github_attachments_branch}— branch for attachment uploads (default: "main")</li>
 * </ul>
 */
public class EscalationServiceGitHubImpl implements EscalationService {

    private static final Logger log = LoggerFactory.getLogger(EscalationServiceGitHubImpl.class);

    private final RemoteClient githubClient;
    private final WorkspaceHelper wksHelper;
    private final TimelineHelper notification;
    private final TicketServiceSql ticketServiceSql;
    private final UserService userService;
    private final Storage storage;

    private final String owner;
    private final String repo;
    private final String attachmentsBranch;

    public EscalationServiceGitHubImpl(Vertx vertx, JsonObject config, TicketServiceSql ts,
                                       UserService us, Storage storage) {
        EventBus eb = Server.getEventBus(vertx);
        this.wksHelper = new WorkspaceHelper(eb, storage);
        this.notification = new TimelineHelper(vertx, eb, config);
        this.ticketServiceSql = ts;
        this.userService = us;
        this.storage = storage;

        this.owner = config.getString("github_owner", "open-ent");
        this.repo = config.getString("github_repo", "support-ent-scolaire");
        this.attachmentsBranch = config.getString("github_attachments_branch", "main");

        String token = config.getString("github_token", "");
        JsonObject clientConf = new JsonObject()
                .put("host", "api.github.com")
                .put("port", 443)
                .put("ssl", true)
                .put("poolSize", 5)
                .put("keepAlive", true)
                .put("headers", new JsonObject()
                        .put("Authorization", "Bearer " + token)
                        .put("Accept", "application/vnd.github+json")
                        .put("X-GitHub-Api-Version", "2022-11-28")
                        .put("User-Agent", "ENT-Support"));

        this.githubClient = new RemoteClient(vertx, clientConf);
    }

    @Override
    public BugTracker getBugTrackerType() {
        return BugTracker.GITHUB;
    }

    // ------------------------------------------------------------------ escalateTicket

    @Override
    public void escalateTicket(HttpServerRequest request, Ticket ticket, UserInfos user,
                               Issue issue, Handler<Either<String, Issue>> handler) {
        if (issue != null && issue.id.get() != null) {
            log.error("[Support] GitHub issue " + issue.id.get() + " already exists for ticket " + ticket.id.get());
            handler.handle(new Either.Left<>("support.escalation.github.error.issue.exists"));
            return;
        }

        String ownerName = ticket.ownerName != null ? ticket.ownerName
                : (user != null ? user.getUsername() : "Inconnu");
        String schoolId = ticket.schoolId != null ? ticket.schoolId : "—";

        String body = buildIssueBody(ticket, ownerName, schoolId);

        createGitHubIssue(ticket.subject, body)
                .compose(ghIssue -> {
                    if (ticket.attachments == null || ticket.attachments.isEmpty()) {
                        return Future.succeededFuture(ghIssue);
                    }
                    return uploadAttachmentsAsComment(ticket, ghIssue.id.get())
                            .map(v -> ghIssue)
                            .recover(err -> {
                                log.warn("[Support] GitHub: attachment upload failed for ticket "
                                        + ticket.id.get(), err);
                                return Future.succeededFuture(ghIssue);
                            });
                })
                .onSuccess(ghIssue -> {
                    ghIssue.attachments = ticket.attachments;
                    handler.handle(new Either.Right<>(ghIssue));
                })
                .onFailure(err -> {
                    log.error("[Support] GitHub: escalation failed for ticket " + ticket.id.get(), err);
                    handler.handle(new Either.Left<>(err.getMessage()));
                });
    }

    private String buildIssueBody(Ticket ticket, String ownerName, String schoolId) {
        return "## Détails du ticket\n\n"
                + "**Auteur :** " + ownerName + "\n"
                + "**École :** `" + schoolId + "`\n"
                + "**Catégorie :** " + (ticket.category != null ? ticket.category : "—") + "\n"
                + "**Ticket ENT :** #" + ticket.id.get() + "\n\n"
                + "---\n\n"
                + (ticket.description != null ? ticket.description : "");
    }

    private Future<Issue> createGitHubIssue(String title, String body) {
        Promise<Issue> promise = Promise.promise();

        JsonObject payload = new JsonObject()
                .put("title", title != null ? title : "(sans titre)")
                .put("body", body);

        githubClient.request(new RequestOptions()
                        .setMethod(HttpMethod.POST)
                        .setURI("/repos/" + owner + "/" + repo + "/issues")
                        .addHeader(HttpHeaders.CONTENT_TYPE, "application/json"))
                .flatMap(req -> req.send(payload.encode()))
                .onSuccess(response -> response.bodyHandler(data -> {
                    if (response.statusCode() != 201) {
                        log.error("[Support] GitHub: issue creation failed ("
                                + response.statusCode() + "): " + data);
                        promise.fail("support.escalation.github.error.issue.creation");
                    } else {
                        JsonObject ghIssue = new JsonObject(data.toString());
                        long number = ghIssue.getLong("number");
                        promise.complete(new Issue(number, BugTracker.GITHUB, ghIssue));
                    }
                }))
                .onFailure(t -> {
                    log.error("[Support] GitHub: issue creation request failed", t);
                    promise.fail("support.escalation.github.error.issue.request");
                });

        return promise.future();
    }

    // ------------------------------------------------------------------ attachments

    private Future<Void> uploadAttachmentsAsComment(Ticket ticket, Long issueNumber) {
        List<Future<String>> uploads = ticket.attachments.stream()
                .map(a -> uploadAttachmentToRepo(a, ticket.id.get()))
                .collect(Collectors.toList());

        return CompositeFuture.all(new ArrayList<>(uploads)).compose(cf -> {
            List<String> lines = new ArrayList<>();
            for (int i = 0; i < ticket.attachments.size(); i++) {
                String url = cf.resultAt(i);
                lines.add("- [" + ticket.attachments.get(i).name + "](" + url + ")");
            }
            return addCommentToIssue(issueNumber,
                    "**Pièces jointes :**\n" + String.join("\n", lines));
        });
    }

    private Future<String> uploadAttachmentToRepo(Attachment attachment, Integer ticketId) {
        if (attachment == null || attachment.documentId == null) {
            return Future.failedFuture("support.escalation.github.error.upload.invalid");
        }

        Promise<WorkspaceHelper.Document> readPromise = Promise.promise();
        wksHelper.readDocument(attachment.documentId, file -> {
            if (file == null) {
                readPromise.fail("support.escalation.github.error.upload.empty.file");
            } else {
                readPromise.complete(file);
            }
        });

        return readPromise.future().compose(file -> {
            Buffer data = file.getData();
            if (data == null || data.length() == 0) {
                return Future.failedFuture("support.escalation.github.error.upload.empty");
            }
            JsonObject doc = file.getDocument();
            String filename = doc.getString("name", "attachment");
            String safeName = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
            String path = "attachments/ticket-" + ticketId + "/" + safeName;
            String encoded = Base64.getEncoder().encodeToString(data.getBytes());

            JsonObject payload = new JsonObject()
                    .put("message", "Support: attachment for ticket #" + ticketId)
                    .put("content", encoded)
                    .put("branch", attachmentsBranch);

            Promise<String> urlPromise = Promise.promise();
            githubClient.request(new RequestOptions()
                            .setMethod(HttpMethod.PUT)
                            .setURI("/repos/" + owner + "/" + repo + "/contents/" + path)
                            .addHeader(HttpHeaders.CONTENT_TYPE, "application/json"))
                    .flatMap(req -> req.send(payload.encode()))
                    .onSuccess(response -> response.bodyHandler(respBody -> {
                        if (response.statusCode() == 201 || response.statusCode() == 200) {
                            JsonObject content = new JsonObject(respBody.toString())
                                    .getJsonObject("content", new JsonObject());
                            String url = content.getString("download_url",
                                    "https://github.com/" + owner + "/" + repo
                                            + "/blob/" + attachmentsBranch + "/" + path);
                            attachment.bugTrackerToken = path;
                            urlPromise.complete(url);
                        } else {
                            log.warn("[Support] GitHub: attachment upload returned "
                                    + response.statusCode() + " for " + path);
                            urlPromise.complete("https://github.com/" + owner + "/" + repo
                                    + "/tree/" + attachmentsBranch);
                        }
                    }))
                    .onFailure(t -> {
                        log.error("[Support] GitHub: attachment upload request failed", t);
                        urlPromise.fail("support.escalation.github.error.upload.request");
                    });
            return urlPromise.future();
        });
    }

    // ------------------------------------------------------------------ getIssue

    @Override
    public void getIssue(Number issueId, Handler<Either<String, Issue>> handler) {
        githubClient.request(new RequestOptions()
                        .setMethod(HttpMethod.GET)
                        .setURI("/repos/" + owner + "/" + repo + "/issues/" + issueId.longValue()))
                .flatMap(HttpClientRequest::send)
                .onSuccess(response -> response.bodyHandler(data -> {
                    if (response.statusCode() != 200) {
                        log.error("[Support] GitHub: getIssue failed ("
                                + response.statusCode() + "): " + data);
                        handler.handle(new Either.Left<>("support.escalation.github.error.issue.get"));
                    } else {
                        JsonObject ghIssue = new JsonObject(data.toString());
                        long number = ghIssue.getLong("number");
                        handler.handle(new Either.Right<>(new Issue(number, BugTracker.GITHUB, ghIssue)));
                    }
                }))
                .onFailure(t -> {
                    log.error("[Support] GitHub: getIssue request failed", t);
                    handler.handle(new Either.Left<>("support.escalation.github.error.issue.request"));
                });
    }

    // ------------------------------------------------------------------ commentIssue

    @Override
    public void commentIssue(Number issueId, Comment comment, Handler<Either<String, Void>> handler) {
        if (issueId == null || comment == null) {
            handler.handle(new Either.Left<>("support.escalation.github.error.comment.invalid"));
            return;
        }
        String body = comment.ownerName != null
                ? "**" + comment.ownerName + "** :\n\n" + comment.content
                : comment.content;

        addCommentToIssue(issueId.longValue(), body)
                .onSuccess(v -> handler.handle(new Either.Right<>(null)))
                .onFailure(t -> handler.handle(new Either.Left<>(t.getMessage())));
    }

    private Future<Void> addCommentToIssue(Long issueNumber, String body) {
        Promise<Void> promise = Promise.promise();
        JsonObject payload = new JsonObject().put("body", body);

        githubClient.request(new RequestOptions()
                        .setMethod(HttpMethod.POST)
                        .setURI("/repos/" + owner + "/" + repo + "/issues/" + issueNumber + "/comments")
                        .addHeader(HttpHeaders.CONTENT_TYPE, "application/json"))
                .flatMap(req -> req.send(payload.encode()))
                .onSuccess(response -> response.bodyHandler(data -> {
                    if (response.statusCode() != 201) {
                        log.error("[Support] GitHub: comment creation failed ("
                                + response.statusCode() + "): " + data);
                        promise.fail("support.escalation.github.error.comment.creation");
                    } else {
                        promise.complete();
                    }
                }))
                .onFailure(t -> {
                    log.error("[Support] GitHub: comment request failed", t);
                    promise.fail("support.escalation.github.error.comment.request");
                });

        return promise.future();
    }

    // ------------------------------------------------------------------ syncAttachments

    @Override
    public void syncAttachments(String ticketId, List<Attachment> attachments,
                                Handler<Either<String, Id<Issue, Long>>> handler) {
        ticketServiceSql.getIssue(ticketId, issueResult -> {
            if (issueResult.isLeft()) {
                handler.handle(new Either.Left<>(issueResult.left().getValue()));
                return;
            }
            Issue issue = issueResult.right().getValue();
            Long issueNumber = issue.id.get();

            List<Attachment> missing = attachments.stream()
                    .filter(a -> issue.attachments.stream().noneMatch(e -> e.equals(a)))
                    .collect(Collectors.toList());

            if (missing.isEmpty()) {
                handler.handle(new Either.Right<>(issue.id));
                return;
            }

            int tId;
            try {
                tId = Integer.parseInt(ticketId);
            } catch (NumberFormatException e) {
                handler.handle(new Either.Left<>("support.escalation.github.error.invalid.ticket.id"));
                return;
            }
            final int finalTId = tId;

            List<Future<String>> uploads = missing.stream()
                    .map(a -> uploadAttachmentToRepo(a, finalTId))
                    .collect(Collectors.toList());

            CompositeFuture.all(new ArrayList<>(uploads)).compose(cf -> {
                List<String> lines = new ArrayList<>();
                for (int i = 0; i < missing.size(); i++) {
                    lines.add("- [" + missing.get(i).name + "](" + cf.resultAt(i) + ")");
                }
                return addCommentToIssue(issueNumber,
                        "**Nouvelles pièces jointes :**\n" + String.join("\n", lines));
            }).onSuccess(v -> handler.handle(new Either.Right<>(issue.id)))
              .onFailure(t -> handler.handle(new Either.Left<>(t.getMessage())));
        });
    }

    // ------------------------------------------------------------------ updateTicketFromBugTracker (webhook)

    /**
     * Called via the Vert.x clustered event bus (address: {@code support.update.bugtracker})
     * when a GitHub webhook event is forwarded by admin-dashboard.
     * <p>
     * Expected message body:
     * <pre>
     * {
     *   "action":  "created" | "closed" | "reopened" | ...,
     *   "issue":   { "number": 42, "state": "open"|"closed", "updated_at": "..." },
     *   "comment": { "body": "...", "user": { "login": "..." }, "created_at": "..." }  // if action=created
     * }
     * </pre>
     */
    @Override
    public void updateTicketFromBugTracker(Message<JsonObject> message,
                                           Handler<Either<String, JsonObject>> handler) {
        JsonObject body = message.body();
        if (body == null) {
            handler.handle(new Either.Left<>("support.escalation.github.error.webhook.empty"));
            return;
        }

        JsonObject ghIssue = body.getJsonObject("issue");
        if (ghIssue == null) {
            handler.handle(new Either.Right<>(new JsonObject().put("status", "ignored")));
            return;
        }

        long issueNumber = ghIssue.getLong("number", -1L);
        if (issueNumber < 0) {
            handler.handle(new Either.Left<>("support.escalation.github.error.webhook.missing.number"));
            return;
        }

        String action = body.getString("action", "");
        JsonObject ghComment = body.getJsonObject("comment");
        String updatedAt = ghIssue.getString("updated_at", "");
        String state = ghIssue.getString("state", "open");
        int statusCode = "closed".equals(state) ? 3 : 1;

        ticketServiceSql.getTicketIdAndSchoolId(issueNumber, ticketResult -> {
            if (ticketResult.isLeft()) {
                log.warn("[Support] GitHub webhook: ticket not found for issue " + issueNumber);
                handler.handle(new Either.Right<>(new JsonObject().put("status", "ignored")));
                return;
            }
            Ticket ticket = ticketResult.right().getValue();
            if (ticket.id.get() == null) {
                handler.handle(new Either.Right<>(new JsonObject().put("status", "ignored")));
                return;
            }
            String ticketIdStr = ticket.id.get().toString();

            ticketServiceSql.updateTicketIssueUpdateDateAndStatus(
                    ticket.id.get().longValue(), updatedAt, (long) statusCode, res -> {
                        if (res.isLeft()) {
                            log.error("[Support] GitHub webhook: status update failed: " + res.left().getValue());
                        }
                    });

            if ("created".equals(action) && ghComment != null) {
                String commenter = ghComment.getJsonObject("user", new JsonObject())
                        .getString("login", "GitHub");
                String histoContent = "**" + commenter + "** (GitHub) :\n\n"
                        + ghComment.getString("body", "");
                ticketServiceSql.createTicketHisto(ticketIdStr, histoContent, statusCode,
                        null, TicketHisto.REMOTE_COMMENT, histoRes -> {
                            if (histoRes.isLeft()) {
                                log.error("[Support] GitHub: histo insert failed: "
                                        + histoRes.left().getValue());
                            }
                            handler.handle(new Either.Right<>(new JsonObject().put("status", "ok")));
                        });
            } else if ("closed".equals(action)) {
                ticketServiceSql.createTicketHisto(ticketIdStr, "Issue GitHub fermée.", statusCode,
                        null, TicketHisto.REMOTE_UPDATED, histoRes ->
                                handler.handle(new Either.Right<>(new JsonObject().put("status", "ok"))));
            } else {
                handler.handle(new Either.Right<>(new JsonObject().put("status", "ok")));
            }
        });
    }

    // ------------------------------------------------------------------ refreshTicketFromBugTracker

    @Override
    public void refreshTicketFromBugTracker(Number issueId, Handler<Either<String, Void>> handler) {
        getIssue(issueId, issueResult -> {
            if (issueResult.isLeft()) {
                handler.handle(new Either.Left<>(issueResult.left().getValue()));
                return;
            }
            Issue issue = issueResult.right().getValue();
            JsonObject ghData = issue.getContent();
            String updatedAt = ghData.getString("updated_at", "");
            int statusCode = "closed".equals(ghData.getString("state", "open")) ? 3 : 1;

            ticketServiceSql.getTicketIdAndSchoolId(issueId.longValue(), ticketResult -> {
                if (ticketResult.isLeft()) {
                    handler.handle(new Either.Left<>(ticketResult.left().getValue()));
                    return;
                }
                Ticket ticket = ticketResult.right().getValue();
                ticketServiceSql.updateTicketIssueUpdateDateAndStatus(
                        ticket.id.get().longValue(), updatedAt, (long) statusCode, updateRes -> {
                            if (updateRes.isLeft()) {
                                handler.handle(new Either.Left<>(updateRes.left().getValue()));
                            } else {
                                handler.handle(new Either.Right<>(null));
                            }
                        });
            });
        });
    }
}
