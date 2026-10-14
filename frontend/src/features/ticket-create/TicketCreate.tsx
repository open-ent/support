import { Button, Flex } from '@open-ent/react';
import { IconArrowLeft } from '@open-ent/react/icons';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { REPORT_CATEGORY, REPORT_URL_MOTIF } from '~/models';
import { useTicketFormOptions } from '~/hooks';
import { useTicketCreateForm } from './hooks/useTicketCreateForm';
import { TicketCancelModal } from './components/TicketCancelModal';
import { TicketCreateActions } from './components/TicketCreateActions';
import { TicketCreateForm } from './components/TicketCreateForm';

export function TicketCreate() {
  const navigate = useNavigate();
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  // /support/tickets/new?motif=signalement — lien de signalement cité dans les CGU.
  const [searchParams] = useSearchParams();
  const initialCategory =
    searchParams.get('motif') === REPORT_URL_MOTIF
      ? REPORT_CATEGORY
      : undefined;

  const { categories, schoolOptions } = useTicketFormOptions();
  const {
    register,
    setValue,
    errors,
    isValid,
    isDirty,
    isPending,
    editorRef,
    attachmentsRef,
    onSubmit,
    onSubmitAndEscalate,
  } = useTicketCreateForm();

  const handleCancelClick = () => {
    if (isDirty) {
      setCancelModalVisible(true);
    } else {
      navigate('/');
    }
  };

  return (
    <>
      <Flex
        className="m-auto w-100 ticket-create-form"
        direction="column"
        gap="16"
      >
        <Flex direction="row">
          <Button
            color="tertiary"
            variant="ghost"
            leftIcon={<IconArrowLeft />}
            onClick={handleCancelClick}
          >
            Retour
          </Button>
        </Flex>

        <TicketCreateForm
          register={register}
          setValue={setValue}
          errors={errors}
          categories={categories}
          initialCategory={initialCategory}
          schoolOptions={schoolOptions}
          editorRef={editorRef}
          onAttachmentsChange={(uploaded) =>
            (attachmentsRef.current = uploaded)
          }
        />

        <TicketCreateActions
          isPending={isPending}
          isValid={isValid}
          onSubmit={onSubmit}
          onSubmitAndEscalate={onSubmitAndEscalate}
          onCancelClick={handleCancelClick}
        />
      </Flex>

      <TicketCancelModal
        isOpen={cancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        onConfirm={() => {
          setCancelModalVisible(false);
          navigate('/');
        }}
      />
    </>
  );
}
