-- Datos iniciales de auth. Ejecutar después de que TypeORM haya creado las tablas.
INSERT INTO permissions (permission_name) VALUES
  ('manage_users'), ('manage_roles'), ('manage_payments')
ON CONFLICT (permission_name) DO NOTHING;

INSERT INTO roles (role_name) VALUES ('ADMIN'), ('USER')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.role_name = 'ADMIN'
ON CONFLICT DO NOTHING;

-- Usuario admin@noema.com / Admin12345 (cambiar la contraseña después del primer login)
INSERT INTO users (email, password, is_active)
VALUES ('admin@noema.com', '$2b$10$ATt1UBblElUgw.2Pacn88OYR.12emlvCJjjJkF2KfGO9DLZ6cXW0a', true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u CROSS JOIN roles r
WHERE u.email = 'admin@noema.com' AND r.role_name = 'ADMIN'
ON CONFLICT DO NOTHING;
