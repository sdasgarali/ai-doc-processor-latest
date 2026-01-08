-- Fix the calculate_client_usage stored procedure to use correct column names

DROP PROCEDURE IF EXISTS calculate_client_usage;

DELIMITER $$

CREATE PROCEDURE calculate_client_usage(
    IN p_client_id INT,
    IN p_period_start DATE,
    IN p_period_end DATE
)
BEGIN
    DECLARE v_total_documents INT DEFAULT 0;
    DECLARE v_total_pages INT DEFAULT 0;
    DECLARE v_total_cost DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_usage_id BIGINT;

    -- Calculate from document_processed table
    -- Using correct column names: cost (not total_cost) and time_initiated (not upload_timestamp)
    SELECT
        COUNT(*) as doc_count,
        COALESCE(SUM(no_of_pages), 0) as page_count,
        COALESCE(SUM(CAST(cost AS DECIMAL(10,2))), 0) as cost_sum
    INTO
        v_total_documents,
        v_total_pages,
        v_total_cost
    FROM document_processed
    WHERE client_id = p_client_id
    AND DATE(time_initiated) BETWEEN p_period_start AND p_period_end;

    -- Insert or update usage record
    INSERT INTO client_usage (
        client_id,
        period_start,
        period_end,
        total_documents,
        total_pages,
        total_cost,
        usage_details
    ) VALUES (
        p_client_id,
        p_period_start,
        p_period_end,
        v_total_documents,
        v_total_pages,
        v_total_cost,
        JSON_OBJECT(
            'documents', v_total_documents,
            'pages', v_total_pages,
            'cost', v_total_cost
        )
    )
    ON DUPLICATE KEY UPDATE
        total_documents = v_total_documents,
        total_pages = v_total_pages,
        total_cost = v_total_cost,
        usage_details = JSON_OBJECT(
            'documents', v_total_documents,
            'pages', v_total_pages,
            'cost', v_total_cost
        ),
        updated_at = CURRENT_TIMESTAMP,
        usage_id = LAST_INSERT_ID(usage_id);

    -- Get the usage_id (either newly inserted or existing)
    SET v_usage_id = LAST_INSERT_ID();
    
    -- If LAST_INSERT_ID returns 0, it means we updated an existing record
    -- So we need to fetch the usage_id
    IF v_usage_id = 0 THEN
        SELECT usage_id INTO v_usage_id
        FROM client_usage
        WHERE client_id = p_client_id
        AND period_start = p_period_start
        AND period_end = p_period_end
        LIMIT 1;
    END IF;

    -- Return the result
    SELECT 
        v_usage_id as usage_id,
        p_client_id as client_id,
        p_period_start as period_start,
        p_period_end as period_end,
        v_total_documents as total_documents,
        v_total_pages as total_pages,
        v_total_cost as total_cost;
END$$

DELIMITER ;
