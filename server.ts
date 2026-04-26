import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";
import dotenv from "dotenv";
import fs from "fs";
import { 
  initializeApp as initializeClientApp 
} from 'firebase/app';
import { 
  getFirestore as getClientFirestore, 
  collection as clientCollection, 
  query as clientQuery, 
  where as clientWhere, 
  getDocs as clientGetDocs, 
  updateDoc as clientUpdateDoc, 
  doc as clientDoc, 
  limit as clientLimit,
  addDoc as clientAddDoc,
  serverTimestamp as clientServerTimestamp,
  initializeFirestore as initializeClientFirestore
} from 'firebase/firestore';

// Import Admin SDK using modern modular patterns
import { initializeApp, getApps, getApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  console.log(`DEBUG: Loaded Firebase Config for TRISHAK: ${firebaseConfig.projectId}`);
}

// Initialize Client SDK for polling with high availability settings (long-polling)
const clientApp = initializeClientApp(firebaseConfig);
const watcherDb = initializeClientFirestore(clientApp, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

// Initialize Firebase Admin correctly for TRISHAK
if (!getApps().length) {
  const targetProjectId = firebaseConfig.projectId;
  
  if (targetProjectId) {
    console.log(`DEBUG: Initializing Admin SDK for specific TRISHAK project: ${targetProjectId}`);
    initializeApp({
      projectId: targetProjectId
    });
  } else {
    console.log("DEBUG: No project ID in config, attempting default initialization...");
    initializeApp();
  }
}

const adminApp = getApp();

// Twilio initialization
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use the correct db instance
  const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
    ? firebaseConfig.firestoreDatabaseId 
    : undefined;
  
  console.log(`DEBUG: Initializing Firestore for Database: ${dbId || '(default)'}`);
  
  // Choose the most direct path to the DB instance
  let db: any;
  try {
     db = dbId ? getFirestore(adminApp, dbId) : getFirestore(adminApp);
  } catch (err) {
     console.error("DEBUG: Primary DB initialization failed, attempting fallback...");
     db = dbId ? getFirestore(dbId) : getFirestore();
  }

  // Connection Test (Relentless)
  const testDbConnection = async () => {
    try {
      console.log(`DEBUG: [TEST] Checking Firestore Admin access for project ${firebaseConfig.projectId} and database ${dbId || '(default)'}...`);
      await db.collection('organizations').limit(1).get();
      console.log("DEBUG: [TEST] Success! Admin access verified.");
    } catch (error: any) {
      console.error(`DEBUG: [TEST] Admin access failed: ${error.code || 'NO_CODE'} - ${error.message}`);
      
      // Automatic Recovery Attempt using High-Availability Client SDK
      if (error.code === 'unavailable' || error.message.includes('UNAVAILABLE')) {
        console.log("DEBUG: [RECOVERY] Service reported as UNAVAILABLE. Checking network or project status.");
      }
        try {
          console.log("DEBUG: [RECOVERY] Admin gRPC blocked or denied. Attempting verification via Long-Polling Client...");
          const q = clientQuery(clientCollection(watcherDb, 'incidents'), clientLimit(1));
          const snapshot = await clientGetDocs(q);
          console.log(`DEBUG: [RECOVERY] Success! Client SDK verified connectivity (Found ${snapshot.size} docs).`);
          console.log("DEBUG: [RECOVERY] The server will continue to use the hardened Client SDK for critical polling tasks.");
        } catch (errFallback) {
          console.error("DEBUG: [RECOVERY] Critical connectivity failure. Both gRPC and Long-Polling failed.");
        }
      }
    };
    testDbConnection();

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/send-onboarding-sms", express.json(), async (req, res) => {
    const { phone, role, uniqueId, organizationId } = req.body;
    if (!twilioClient) return res.status(503).json({ error: "Twilio not configured" });

    try {
      const message = `TRISHAK 🚨\nYour account has been created.\n\nRole: ${role}\nID: ${uniqueId}\nOrg ID: ${organizationId}\n\nUse these credentials to login.`;
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to send onboarding SMS:", error);
      if (error.code === 21608) return res.status(400).json({ error: "Twilio Trial Limit: Unverified number." });
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  app.post("/api/send-guest-sms", express.json(), async (req, res) => {
    const { phone, name, guestId } = req.body;
    if (!twilioClient) return res.status(503).json({ error: "Twilio not configured" });

    try {
      const message = `Hello ${name}, welcome to TRISHAK. Your phone number is ${phone} and your Guest ID is ${guestId}. Use this ID to log in.`;
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to send guest SMS:", error);
      if (error.code === 21608) return res.status(400).json({ error: "Twilio Trial Limit: Unverified number." });
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  console.log("Starting Incident Watcher (Authorized)...");
  
  const pollIncidents = async () => {
    try {
      const q = clientQuery(
        clientCollection(watcherDb, 'incidents'),
        clientWhere('alertsSent', '==', false),
        clientLimit(10)
      );
      
      const snapshot = await clientGetDocs(q);

      if (!snapshot.empty) {
        console.log(`Polling: Found ${snapshot.size} incidents to process.`);
        for (const docSnap of snapshot.docs) {
          const incident = { id: docSnap.id, ...docSnap.data() } as any;
          const incidentRef = clientDoc(watcherDb, 'incidents', docSnap.id);
          
          if (incident.isGlobal === true || incident.severity === 'critical') {
            console.log(`🚨 Triggering alerts for incident: ${incident.id}`);
            await clientUpdateDoc(incidentRef, { alertsSent: true });
            await triggerAlerts(incident);
          } else {
            console.log(`Incident ${incident.id} is non-critical, marking as processed.`);
            await clientUpdateDoc(incidentRef, { alertsSent: true });
          }
        }
      }
    } catch (error) {
      console.error("Incident Watcher Error (Client SDK):", error);
    }
    setTimeout(pollIncidents, 10000);
  };

  pollIncidents();

  async function triggerAlerts(incident: any) {
    if (!twilioClient) return;
    try {
      const q = clientQuery(
        clientCollection(watcherDb, 'users'),
        clientWhere('organizationId', '==', incident.organizationId),
        clientWhere('status', '==', 'active')
      );
      const snapshot = await clientGetDocs(q);

      const allActiveUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as any));
      let eligibleUsers = [];
      const secType = incident.type;
      
      if (['theft', 'medical', 'fire', 'other'].includes(secType)) {
        eligibleUsers = allActiveUsers.filter(u => (u.role === 'security' && u.securityType === secType) || u.role === 'admin');
      } else {
        eligibleUsers = allActiveUsers.filter(u => ['staff', 'security', 'receptionist', 'admin'].includes(u.role));
      }

      const targetUsers = eligibleUsers.filter(u => u.uid !== incident.triggeredBy);

      if (targetUsers.length > 0) {
        await sendAlertsToUsers(targetUsers, incident);
      } else {
        const adminQ = clientQuery(
          clientCollection(watcherDb, 'users'),
          clientWhere('organizationId', '==', incident.organizationId),
          clientWhere('role', '==', 'admin')
        );
        const adminSnap = await clientGetDocs(adminQ);
        const fallbackAdmins = adminSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as any)).filter(u => u.uid !== incident.triggeredBy);
        if (fallbackAdmins.length > 0) await sendAlertsToUsers(fallbackAdmins, incident);
      }
    } catch (error) {
      console.error("Error in triggerAlerts (Client SDK):", error);
    }
  }

  async function sendAlertsToUsers(users: any[], incident: any) {
    const smsMessage = `🚨 TRISHAK ALERT: Emergency at ${incident.location.address}. Type: ${incident.type}.`;
    for (const user of users) {
      if (!user.phone) continue;
      try {
        await twilioClient!.messages.create({ body: smsMessage, from: process.env.TWILIO_PHONE_NUMBER, to: user.phone });
        
        // Log via Client SDK
        await clientAddDoc(clientCollection(watcherDb, 'alertLogs'), {
          incidentId: incident.id,
          sentTo: user.uid,
          type: 'sms',
          timestamp: clientServerTimestamp()
        });

        if (incident.severity === 'critical' || incident.isGlobal) {
          await twilioClient!.calls.create({
            twiml: `<Response><Say voice="alice">Emergency alert. Assistance required at ${incident.location.address}.</Say></Response>`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: user.phone
          });
          
          await clientAddDoc(clientCollection(watcherDb, 'alertLogs'), {
            incidentId: incident.id,
            sentTo: user.uid,
            type: 'call',
            timestamp: clientServerTimestamp()
          });
        }
      } catch (err) {
        console.error(`Failed to alert user ${user.uid}:`, err);
      }
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 TRISHAK Server running on http://localhost:${PORT}`);
  });
}

startServer();
