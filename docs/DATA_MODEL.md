# DATA MODEL

## users
- id
- full_name
- email
- role: admin | teacher | cskh | media
- active

## students
- id
- student_code
- full_name
- date_of_birth
- class_id
- teacher_id
- cskh_owner_id
- parent_name
- parent_phone
- media_permission: yes | no | pending
- pulse: green | yellow | red
- active

## classes
- id
- name
- teacher_id
- schedule_text
- active

## sessions
- id
- class_id
- lesson_date
- lesson_title
- homework_new
- status: planned | in_progress | completed

## session_student_records
- id
- session_id
- student_id
- attendance: present | absent_excused | absent_unexcused
- homework_old: done | missing | partial | not_applicable
- old_lesson_score
- vocabulary_score
- grammar_score
- needs_attention
- attention_reason
- note

## tasks
- id
- student_id
- source_type
- task_type
- title
- owner_id
- backup_owner_id
- priority: normal | high | urgent
- due_at
- status: open | waiting_parent | waiting_teacher | done
- result
- follow_up_at

## media
- id
- student_id nullable
- class_id
- session_id
- uploader_id
- storage_key
- media_type
- content_tag
- approved_for_media
- media_status: private | pending | approved | used
- created_at

## tuition
- id
- student_id
- course_name
- total_sessions
- used_sessions
- amount_due
- amount_paid
- status
- expected_end_date
- renewal_status

## parent_contacts
- id
- student_id
- staff_id
- channel
- reason
- summary
- outcome
- next_follow_up_at
- created_at


## Schema thực thi Phase 2 (ưu tiên hơn blueprint bên trên)

- `class_sessions`: class/teacher FK, start/end UTC, lesson/content/homework, status enum, optimistic version, created_by/updated_by/completed_by/at; unique class + start.
- `session_student_records`: roster snapshot qua start RPC, session+student unique, attendance/homework/old_lesson enum, score 0–10 nullable, attention boolean + constrained reasons array.
- `record_notes`: teacher_note riêng, teacher/admin RLS; không có note text trong core records/events CSKH.
- `tasks`: typed kind/priority/status, student/source session/record, owner nullable/backup, result/follow-up/deadline, version/audit; unique active student+type.
- `student_events`: typed allowed event names, summary không private note, unique idempotency_key, actor/time/source task/session.
- `session_attachments`: session/student optional, actor, UUID storage path, validated MIME/size, private object; download qua RLS.
- `private.teaching_rules`: canonical threshold config; version bằng migration.

Teacher/CSKH assignments, students.class_id và parent contacts từ Phase 1 được giữ nguyên; không thêm tuition, marketing media hoặc parent_contacts nghiệp vụ trong Phase 2.
