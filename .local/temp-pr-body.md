## Description

Adds task file attachments capability. Users can upload files (up to 10MB) directly to tasks, download them, or delete them. Uploads and deletions automatically log project activities.

## What's inside

- **Backend**: `TaskAttachment` entity, `task_attachments` table with cascade delete, repository, `UploadTaskAttachmentCommand`, `DeleteTaskAttachmentCommand`, `DownloadTaskAttachmentQuery`, `ListTaskAttachmentsQuery`, and controller endpoints in `TasksController`.
- **Frontend**: Attachments section in `TaskDetailPanel` with file picker, size indicator, download trigger, and delete button.

## Type of change

- [x] Feature

## Checklist

- [x] Backend build & unit tests pass
- [x] Frontend build passes
- [x] Verified multipart upload and file download
