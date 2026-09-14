import pg from 'pg';

const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const devEmail=String(process.env.ALLOW_DEV_EMAIL_CODE||'false')==='true';
const autoApprove=String(process.env.AUTO_APPROVE_REGISTRATIONS||'false')==='true';

try{
  if(devEmail){
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE OR REPLACE FUNCTION force_test_verification_code()
      RETURNS trigger AS $$
      BEGIN
        NEW.code_hash=encode(digest('000000','sha256'),'hex');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS force_test_verification_code_trigger ON verification_codes;
      CREATE TRIGGER force_test_verification_code_trigger
      BEFORE INSERT OR UPDATE ON verification_codes
      FOR EACH ROW EXECUTE FUNCTION force_test_verification_code();
    `);
    console.log('Test email code enabled: 000000');
  }else{
    await pool.query('DROP TRIGGER IF EXISTS force_test_verification_code_trigger ON verification_codes');
  }

  if(autoApprove){
    await pool.query(`
      CREATE OR REPLACE FUNCTION auto_approve_registration()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.status='pending_admin' THEN
          NEW.status='trial';
          NEW.trial_start=COALESCE(NEW.trial_start,now());
          NEW.trial_end=COALESCE(NEW.trial_end,now()+interval '7 days');
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS auto_approve_registration_trigger ON users;
      CREATE TRIGGER auto_approve_registration_trigger
      BEFORE INSERT OR UPDATE OF status ON users
      FOR EACH ROW EXECUTE FUNCTION auto_approve_registration();
    `);
    console.log('Registration admin approval disabled');
  }else{
    await pool.query('DROP TRIGGER IF EXISTS auto_approve_registration_trigger ON users');
  }
}finally{
  await pool.end();
}
