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
