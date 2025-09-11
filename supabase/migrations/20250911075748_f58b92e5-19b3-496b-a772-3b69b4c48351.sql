-- Update the user role from viewer to admin
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = (
  SELECT id FROM profiles WHERE email = 'luket@prowebenhance.com'
);