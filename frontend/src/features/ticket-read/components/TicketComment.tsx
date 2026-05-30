import { Avatar, Flex } from '@open-ent/react';
import { Editor } from '@open-ent/react/editor';
import { TicketComment as TicketCommentType } from '~/models';
import { getAvatarURL } from '~/utils/getAvatarURL';
import { FormattedDate } from './FormattedDate';

type TicketCommentProps = {
  comment: TicketCommentType;
};

export function TicketComment({ comment }: TicketCommentProps) {
  return (
    <Flex className="pt-24 pb-16 ps-24 pe-32 border-bottom-light" gap="16">
      <Avatar variant="circle" alt="avatar" src={getAvatarURL(comment.owner)} />
      <Flex direction="column" gap="4" className="flex-grow-1">
        <Flex gap="4">
          <a href={`/userbook/annuaire#${comment.owner}`}>
            <p className="small user-profile-relative">
              <strong>{comment.owner_name}</strong>
            </p>
          </a>

          <p className="small">|</p>

          <p className="small">
            <FormattedDate date={comment.created} />
          </p>
        </Flex>

        <Editor
          id="message-body"
          content={comment.content}
          mode="read"
          variant="ghost"
        />
      </Flex>
    </Flex>
  );
}
