SELECT 'Organization' AS table_name, COUNT(*) AS row_count FROM "Organization";
SELECT 'Campus' AS table_name, COUNT(*) AS row_count FROM "Campus";
SELECT 'User' AS table_name, COUNT(*) AS row_count FROM "User";
SELECT 'Student' AS table_name, COUNT(*) AS row_count FROM "Student";
SELECT 'FeeHead' AS table_name, COUNT(*) AS row_count FROM "FeeHead";
SELECT 'FeeStructure' AS table_name, COUNT(*) AS row_count FROM "FeeStructure";
SELECT 'FeeChallan' AS table_name, COUNT(*) AS row_count FROM "FeeChallan";

SELECT "email", "role", "isActive"
FROM "User"
WHERE "email" = 'admin@sair.com';
