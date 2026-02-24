#!/bin/bash

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
sleep 10

# Get the root password from docker inspect
ROOT_PASS=$(docker inspect pax-db-dev | grep "MYSQL_ROOT_PASSWORD" | sed 's/.*MYSQL_ROOT_PASSWORD=\(.*\)".*/\1/')

echo "Creating legacyUser with correct password..."
docker exec pax-db-dev mysql -u root -p"${ROOT_PASS}" -e "
CREATE USER IF NOT EXISTS 'legacyUser'@'%' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON LegacyPAXMDB.* TO 'legacyUser'@'%';
FLUSH PRIVILEGES;
SELECT user, host FROM mysql.user WHERE user='legacyUser';
"

echo "Done! User legacyUser created successfully."
