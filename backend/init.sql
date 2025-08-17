cat > backend/init.sql << 'EOF'
-- Initialize TypeTrack database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for better performance
-- These will be created by SQLAlchemy, but this file ensures PostgreSQL is ready
EOF

