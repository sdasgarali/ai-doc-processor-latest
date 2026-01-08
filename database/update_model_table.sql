-- Add doc_category and purpose fields to model table
ALTER TABLE model
ADD COLUMN doc_category_id INT,
ADD COLUMN purpose TEXT,
ADD FOREIGN KEY (doc_category_id) REFERENCES doc_category(category_id) ON DELETE SET NULL,
ADD INDEX idx_doc_category_id (doc_category_id);
