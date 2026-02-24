# Enhanced Search Functionality

## Overview
The search functionality has been enhanced to provide more flexible and powerful searching capabilities.

## Features

### 1. Case-Insensitive Search
- All searches are now case-insensitive
- Example: searching for "john" will match "John", "JOHN", or "john"

### 2. Partial Word Matching
- Search terms can match parts of words, not just complete words
- Example: searching for "app" will match:
  - "Apple" (last name)
  - "application" (in email)
  - "happy" (in any field)

### 3. Multi-Term Search (AND Logic)
- Multiple search terms separated by spaces
- ALL terms must be present in the record (can be in different fields)
- Example: "John app" will match:
  - First name: "John", Last name: "Apple"
  - First name: "Johnny", Email: "john@apple.com"
  - Last name: "Johnson", Email: "user@app.com"

## Searchable Fields
The following fields are searched:
- `favourite`
- `first_name` 
- `last_name`
- `email`
- `state`

## Implementation Details

### Backend Changes
The search logic in `/backend/server.js` has been updated to:
1. Split the search string into individual terms
2. Create SQL conditions where each term must match at least one field
3. Combine conditions with AND logic (all terms must match)
4. Use `LOWER()` SQL function for case-insensitive matching
5. Use `LIKE` operator with wildcards for partial matching

### SQL Query Pattern
```sql
-- For search "john app"
WHERE (
  LOWER(favourite) LIKE '%john%' OR 
  LOWER(first_name) LIKE '%john%' OR 
  LOWER(last_name) LIKE '%john%' OR 
  LOWER(email) LIKE '%john%' OR 
  LOWER(state) LIKE '%john%'
) AND (
  LOWER(favourite) LIKE '%app%' OR 
  LOWER(first_name) LIKE '%app%' OR 
  LOWER(last_name) LIKE '%app%' OR 
  LOWER(email) LIKE '%app%' OR 
  LOWER(state) LIKE '%app%'
)
```

## Usage Examples

| Search Input | Will Match |
|--------------|------------|
| `john` | Any record with "john" in any field |
| `John Apple` | Records with both "john" AND "apple" (case-insensitive) |
| `app` | Records with "app" anywhere (Apple, application, etc.) |
| `jane app` | Jane Apple, jane@apple.com, etc. |
| `act` | Records with state "active" |

## Frontend Usage
No changes are required in the frontend. The existing search input in `Table.tsx` will automatically use the enhanced search functionality.
