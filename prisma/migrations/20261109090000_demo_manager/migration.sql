ALTER TABLE "Recipe" ADD COLUMN "reviewRequired" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "DemoJob" (
 "id" TEXT PRIMARY KEY, "kind" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'QUEUED',
 "actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL, "previewHash" TEXT,
 "backupPath" TEXT, "backupHash" TEXT, "result" JSONB, "error" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3),
 CHECK ("kind" IN ('SEED','CLEANUP')),
 CHECK ("status" IN ('QUEUED','RUNNING','DONE','FAILED'))
);
CREATE UNIQUE INDEX demo_one_job ON "DemoJob" ((true)) WHERE status IN ('QUEUED','RUNNING');
CREATE TABLE "DemoControl" ("id" INTEGER PRIMARY KEY DEFAULT 1 CHECK (id=1), "maintenanceJob" TEXT);
INSERT INTO "DemoControl" (id) VALUES (1);
CREATE TABLE "DemoRecord" ("tableName" TEXT NOT NULL, "recordId" TEXT NOT NULL, "batchId" TEXT NOT NULL, PRIMARY KEY ("tableName","recordId"));
CREATE TABLE "DemoDeletePermit" ("jobId" TEXT NOT NULL,"tableName" TEXT NOT NULL,"recordId" TEXT NOT NULL,"fingerprint" TEXT NOT NULL,PRIMARY KEY ("jobId","tableName","recordId"));

-- Maintenance applies at the database boundary, including an in-flight web request.
-- Only the job connection with the matching transaction-local capability can write.
CREATE FUNCTION cafe_demo_maintenance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE job TEXT;
BEGIN
 SELECT "maintenanceJob" INTO job FROM "DemoControl" WHERE id=1;
 IF job IS NOT NULL AND current_setting('cafe.demo_job',true) IS DISTINCT FROM job THEN
   RAISE EXCEPTION 'Demo preparation is running. Please try again shortly.';
 END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION cafe_demo_capture() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE batch TEXT; job TEXT;
BEGIN
 batch := current_setting('cafe.demo_batch',true);
 job := current_setting('cafe.demo_job',true);
 IF COALESCE(batch,'') <> '' AND EXISTS (
   SELECT 1 FROM "DemoControl" c JOIN "DemoJob" j ON j.id=c."maintenanceJob"
   WHERE c.id=1 AND c."maintenanceJob"=job AND j.status='RUNNING' AND j.kind='SEED'
 ) THEN
   INSERT INTO "DemoRecord" ("tableName","recordId","batchId") VALUES (TG_TABLE_NAME, NEW.id::text,batch);
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t RECORD; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'Demo%' AND tablename <> '_prisma_migrations' LOOP
   EXECUTE format('CREATE TRIGGER demo_maintenance BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION cafe_demo_maintenance()',t.tablename);
   IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t.tablename AND column_name='id' AND data_type='text') THEN
    EXECUTE format('CREATE TRIGGER demo_capture AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION cafe_demo_capture()',t.tablename);
   END IF;
 END LOOP;
END $$;
-- An exact current-row permit, a verified-backup job and a matching maintenance
-- transaction are ALL required. UPDATE remains forbidden, including during reset.
CREATE FUNCTION cafe_demo_delete_allowed(tab TEXT, row_data JSONB) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT EXISTS (
 SELECT 1 FROM "DemoDeletePermit" p JOIN "DemoJob" j ON j.id=p."jobId"
 JOIN "DemoControl" c ON c."maintenanceJob"=j.id
 WHERE c.id=1 AND j.status='RUNNING' AND j.kind='CLEANUP'
 AND j."backupHash" IS NOT NULL AND j."backupPath" IS NOT NULL
 AND j.id=current_setting('cafe.demo_job',true)
 AND p."tableName"=tab AND p."recordId"=row_data->>'id'
 AND p.fingerprint=md5(row_data::text))
$$;
CREATE OR REPLACE FUNCTION cafe_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' AND cafe_demo_delete_allowed(TG_TABLE_NAME,to_jsonb(OLD)) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Posted cafe records cannot be edited or deleted; record a reversal';
END $$;
CREATE OR REPLACE FUNCTION cafe_delivery_commission_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN
  IF cafe_demo_delete_allowed(TG_TABLE_NAME,to_jsonb(OLD)) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Commission history cannot be deleted';
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW."orderId" IS DISTINCT FROM OLD."orderId" OR NEW."riderId" IS DISTINCT FROM OLD."riderId"
 OR NEW.rate IS DISTINCT FROM OLD.rate OR NEW.basis IS DISTINCT FROM OLD.basis OR NEW.amount IS DISTINCT FROM OLD.amount
 OR NEW."journalId" IS DISTINCT FROM OLD."journalId" OR NEW.date IS DISTINCT FROM OLD.date OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
 OR OLD."reversedAt" IS NOT NULL OR NEW."reversedAt" IS NULL THEN
 RAISE EXCEPTION 'Commission amounts are immutable; record a reversal'; END IF;
 RETURN NEW;
END $$;
