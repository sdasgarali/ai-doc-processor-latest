-- Add unique constraint to field_table for field_name + doc_category combination
ALTER TABLE field_table
ADD CONSTRAINT unique_field_name_doc_category UNIQUE (field_name, doc_category);
