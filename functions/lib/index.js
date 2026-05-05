"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
admin.initializeApp();
(0, v2_1.setGlobalOptions)({ region: "asia-southeast1" });
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send("Unauthorized: No Bearer token provided");
    }
    const idToken = authHeader.split("Bearer ")[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    }
    catch (error) {
        console.error("Error verifying token:", error);
        return res.status(401).send("Unauthorized: Invalid token");
    }
};
app.post("/notify", authenticate, async (req, res) => {
    const { type, source, title, message, category } = req.body;
    const userEmail = req.user?.email;
    if (!userEmail) {
        return res.status(401).send("Unauthorized: User email not found in token");
    }
    if (!type || !source || !title || !message || !category) {
        return res.status(400).send("Bad Request: Missing required fields");
    }
    try {
        const docRef = await admin.firestore().collection("notifications").add({
            userEmail,
            type,
            source,
            title,
            message,
            category,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.status(200).send({ id: docRef.id });
    }
    catch (error) {
        console.error("Error adding notification:", error);
        return res.status(500).send("Internal Server Error");
    }
});
exports.api = (0, https_1.onRequest)(app);
//# sourceMappingURL=index.js.map