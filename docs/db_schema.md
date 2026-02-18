# LEXI — DB 스키마

## cards
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 자동 생성 |
| title | text | 개념 제목 (추출 or 직접 입력) |
| source_file | text | 원본 PDF 파일명 |
| extracted_concepts | jsonb | Gemini가 추출한 개념 목록 |
| my_insight | text | 내가 쓴 한 줄 인사이트 |
| chat_history | jsonb | 학습 대화 기록 배열 [{role, content}] |
| created_at | timestamptz | 생성 시각 |

## connections
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 자동 생성 |
| card_id_a | uuid (FK → cards.id) | 연결 카드 A |
| card_id_b | uuid (FK → cards.id) | 연결 카드 B |
| reason | text | AI가 설명한 연결 이유 |
| created_at | timestamptz | 생성 시각 |

## Supabase 설정 메모
- RLS 정책: 개인 사용이므로 초기엔 비활성화 또는 단순 정책으로 시작
- cascade 삭제: cards 삭제 시 connections도 자동 삭제되도록 FK 설정