package net.atos.entng.support.controllers;

import fr.wseduc.rs.Get;
import fr.wseduc.security.ActionType;
import fr.wseduc.security.SecuredAction;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.json.JsonObject;
import net.atos.entng.support.constants.JiraTicket;
import org.entcore.common.controller.ControllerHelper;
import org.entcore.common.http.filter.AdminFilter;
import org.entcore.common.http.filter.ResourceFilter;
import org.entcore.common.http.filter.SuperAdminFilter;

public class ConfigController extends ControllerHelper {
    @Get("/config")
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @ResourceFilter(SuperAdminFilter.class)
    public void getConfig(final HttpServerRequest request) {
        renderJson(request, config);
    }

    @Get("/config/thresholdDirectExportTickets")
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @ResourceFilter(AdminFilter.class)
    public void getConfigMaxTickets(final HttpServerRequest request) {
        renderJson(request, new JsonObject().put(JiraTicket.THRESHOLD, getThresholdDirectExportTickets()));
    }

    /**
     * Renvoie le seuil de bascule export direct / worker sous forme d'entier.
     * Tolère une valeur de configuration absente, vide, numérique ou textuelle :
     * en cas d'absence ou de valeur invalide, on retombe sur la valeur par défaut (1000).
     * Sans ce fallback, une valeur null/vide était interprétée comme 0 côté front,
     * envoyant tout export (même un seul ticket) vers le worker asynchrone.
     */
    private int getThresholdDirectExportTickets() {
        Object raw = config.getValue(JiraTicket.THRESHOLD_DIRECT_EXPORT_TICKETS);
        if (raw instanceof Number) {
            return ((Number) raw).intValue();
        }
        if (raw instanceof String) {
            try {
                String value = ((String) raw).trim();
                if (!value.isEmpty()) {
                    return Integer.parseInt(value);
                }
            } catch (NumberFormatException ignored) {
                // valeur non numérique : on retombe sur le défaut
            }
        }
        return JiraTicket.THRESHOLD_DIRECT_EXPORT_TICKETS_DEFAULT;
    }

    @Get("/config/numberTicketsPerPage")
    @SecuredAction(value = "", type = ActionType.AUTHENTICATED)
    public void getNumberTicketsPerPage(final HttpServerRequest request) {
        renderJson(request, new JsonObject().put(JiraTicket.NBTICKETSPERPAGE, config.getInteger(JiraTicket.NBTICKETSPERPAGE, 25)));
    }
}