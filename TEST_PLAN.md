# DocuParse UAT & Integration Test Plan

## Test Environment
- **Production URL**: https://docuparse.vercel.app
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (auto-deploy from GitHub main branch)

## Test Credentials

### SuperAdmin User
- **Email**: admin@docuparse.com
- **Password**: Admin123! (or check with admin)
- **Role**: superadmin

### Test Client User
- **Email**: testclient@docuparse.com
- **Password**: TestClient123!
- **Role**: client
- **Client**: Demo Client (ID: 7)

---

## Module Test Cases

### 1. Authentication Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| AUTH-01 | Login with valid superadmin credentials | Successful login, redirect to dashboard | Critical |
| AUTH-02 | Login with valid client credentials | Successful login, redirect to dashboard | Critical |
| AUTH-03 | Login with invalid credentials | Error message "Invalid email or password" | High |
| AUTH-04 | Login with inactive account | Error message "Account is inactive" | High |
| AUTH-05 | Logout functionality | Session cleared, redirect to login | High |
| AUTH-06 | Token expiration | Auto-logout after token expires | Medium |

### 2. Dashboard Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| DASH-01 | View dashboard analytics (admin) | Display totals for users, clients, models, fields, categories | Critical |
| DASH-02 | View user statistics | Display active/inactive users by role | High |
| DASH-03 | View client statistics | Display active/inactive clients | High |
| DASH-04 | View recent users/clients | List of recently added users and clients | Medium |
| DASH-05 | Fields by category chart | Display bar chart of field distribution | Medium |

### 3. User Management Module (Admin Only)

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| USER-01 | List all users | Display paginated user list with client names | Critical |
| USER-02 | Filter users by role | Show only users of selected role | High |
| USER-03 | Filter users by status | Show only active/inactive users | High |
| USER-04 | Filter users by client | Show only users of selected client | High |
| USER-05 | Create new user | User created with hashed password | Critical |
| USER-06 | Edit user details | User details updated successfully | High |
| USER-07 | Reset user password | Password updated successfully | High |
| USER-08 | Delete user (superadmin only) | User deleted | High |

### 4. Client Management Module (Admin Only)

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| CLIENT-01 | List all clients | Display paginated client list | Critical |
| CLIENT-02 | Filter clients by status | Show active/inactive clients | High |
| CLIENT-03 | Create new client | Client created successfully | Critical |
| CLIENT-04 | Edit client details | Client details updated | High |
| CLIENT-05 | Delete client (no associated users) | Client deleted | Medium |
| CLIENT-06 | Delete client (with associated users) | Error: Cannot delete | Medium |

### 5. Document Categories Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| CAT-01 | List all categories | Display all document categories | High |
| CAT-02 | Create new category | Category created | Medium |
| CAT-03 | Edit category | Category updated | Medium |
| CAT-04 | Delete category (superadmin only) | Category deleted | Low |

### 6. Field Management Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| FIELD-01 | List all fields | Display fields with category names | High |
| FIELD-02 | Filter fields by category | Show only fields of selected category | High |
| FIELD-03 | Create new field | Field created with validation | High |
| FIELD-04 | Edit field | Field updated | High |
| FIELD-05 | Delete field | Field deleted | Medium |

### 7. Output Profiles Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| PROFILE-01 | List all output profiles | Display profiles with enriched data | High |
| PROFILE-02 | Filter by category | Show profiles of selected category | Medium |
| PROFILE-03 | Filter by client | Show profiles of selected client | Medium |
| PROFILE-04 | Create new profile | Profile created | High |
| PROFILE-05 | Edit profile | Profile updated | High |
| PROFILE-06 | Manage profile fields | Fields added/removed/reordered | High |

### 8. Processing Engine Configuration Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| CONFIG-01 | View all configurations | Display grouped configurations | Critical |
| CONFIG-02 | View default configurations | Show global configs (null category) | High |
| CONFIG-03 | Edit configuration value | Config updated | High |
| CONFIG-04 | Create new configuration | Config created | Medium |
| CONFIG-05 | Sensitive values masked | Encrypted values show as **** | High |

### 9. Permissions Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| PERM-01 | View all permissions | Display permissions grouped by category | High |
| PERM-02 | View role permissions | Show permissions for selected role | High |
| PERM-03 | Update role permissions | Role permissions updated | High |
| PERM-04 | View user-specific permissions | Show user's role + specific permissions | High |

### 10. Model Versions Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| MODEL-01 | List all model versions | Display models with category and AI model names | High |
| MODEL-02 | Create new model | Model created | Medium |
| MODEL-03 | Edit model | Model updated | Medium |
| MODEL-04 | Delete model | Model deleted | Low |

### 11. Documents Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| DOC-01 | List documents (admin) | Show all documents | Critical |
| DOC-02 | List documents (client) | Show only client's documents | Critical |
| DOC-03 | Filter by status | Show filtered documents | High |
| DOC-04 | Filter by date range | Show documents in date range | High |
| DOC-05 | View document details | Display document with enriched data | High |

### 12. Reports Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| REPORT-01 | Client usage report | Display usage by client | High |
| REPORT-02 | Export to Excel | Download Excel file | High |
| REPORT-03 | Processing summary | Display summary statistics | High |

### 13. Billing Module

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| BILL-01 | View mail logs | Display email logs | Medium |
| BILL-02 | View invoice list | Display invoices | Medium |

---

## End-to-End Workflow Test

### E2E-01: Complete Document Processing Flow

**Prerequisites**:
- Admin user logged in
- Processing engine configuration complete
- Test PDF file ready

**Steps**:
1. Navigate to Upload page
2. Select client "Demo Client"
3. Select document category "EOB"
4. Upload test PDF file
5. Monitor processing status
6. Verify extracted data
7. Download CSV/JSON output

**Expected Results**:
- Document uploaded successfully
- Processing status updates in real-time
- Extracted records displayed correctly
- Download links available

---

## Test Data

### Test PDF Files
- Location: `python_processor/eob-results/`
- Files: Standard EOB PDFs for testing

### Test Clients
- Demo Client (ID: 7)
- Test Client 1 (ID: 1)

### Test Users
- SuperAdmin: admin@docuparse.com
- Client User: testclient@docuparse.com

---

## Regression Test Checklist

After each code change, verify:

- [ ] Login works for all user roles
- [ ] Dashboard loads without errors
- [ ] User management CRUD operations work
- [ ] Client management CRUD operations work
- [ ] Document list loads correctly
- [ ] Reports generate correctly
- [ ] Processing configuration is accessible
- [ ] Output profiles display correctly

---

## Known Issues & Limitations

1. **Supabase Constraints**: No JOIN queries in REST API - all joins done in memory
2. **Sequence Gaps**: Some ID sequences have gaps due to failed inserts
3. **N8N Integration**: Requires separate n8n instance for document processing

---

## Test Execution Log

| Date | Tester | Module | Test Cases | Passed | Failed | Notes |
|------|--------|--------|------------|--------|--------|-------|
| | | | | | | |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Dev Lead | | | |
| Product Owner | | | |
