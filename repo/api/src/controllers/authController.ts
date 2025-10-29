import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key";

// ✅ REGISTER (No changes needed for register)
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, phone } = req.body;

    if (!email || !password || !phone) {
      return res.status(400).json({ message: "Email, password and phone are required" });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let role = await prisma.role.findFirst({ where: { name: "user" } });
    if (!role) {
      role = await prisma.role.create({ data: { name: "user" } });
    }

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        fullName,
        roleId: role.id,
      },
    });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
      },
    });
  } catch (err: any) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ✅ LOGIN (Updated for VS Code flow)
export const login = async (req: Request, res: Response) => {
  try {
    // --- Extract potential VS Code flow parameters ---
    const { email, password, callback, nonce } = req.body;
    const isVSCodeFlow = typeof callback === 'string' && typeof nonce === 'string';
    // --------------------------------------------------

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        // --- Handle redirect for VS Code flow on failure ---
        if (isVSCodeFlow) {
            const errorCallbackUrl = new URL(callback);
            errorCallbackUrl.searchParams.set('error', 'Invalid credentials');
            if (nonce) errorCallbackUrl.searchParams.set('nonce', nonce); // Return nonce on error too
            console.warn(`VS Code login failed (user not found), redirecting to: ${errorCallbackUrl.toString()}`);
            return res.redirect(302, errorCallbackUrl.toString());
        }
        // ---------------------------------------------------
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
         // --- Handle redirect for VS Code flow on failure ---
        if (isVSCodeFlow) {
            const errorCallbackUrl = new URL(callback);
            errorCallbackUrl.searchParams.set('error', 'Invalid credentials');
             if (nonce) errorCallbackUrl.searchParams.set('nonce', nonce);
            console.warn(`VS Code login failed (invalid password), redirecting to: ${errorCallbackUrl.toString()}`);
            return res.redirect(302, errorCallbackUrl.toString());
        }
        // ---------------------------------------------------
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Login successful, generate token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d", // Consider a shorter duration for browser flow?
    });

    // --- Handle response based on flow ---
    if (isVSCodeFlow) {
        // Construct the vscode:// callback URL with the token and nonce
        const callbackUrlWithToken = new URL(callback);
        callbackUrlWithToken.searchParams.set('token', token);
        callbackUrlWithToken.searchParams.set('nonce', nonce); // Return the nonce

        console.log(`VS Code login successful, redirecting to: ${callbackUrlWithToken.toString()}`);
        // Send HTTP 302 Redirect response
        return res.redirect(302, callbackUrlWithToken.toString());

    } else {
        // Standard web/API login, return JSON
        console.log(`Standard login successful for ${email}`);
        return res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                fullName: user.fullName,
            },
        });
    }
    // ------------------------------------

  } catch (err: any) {
    console.error("Login error:", err);
    // --- Handle redirect for VS Code flow on internal error ---
    const { callback, nonce } = req.body; // Re-check in case error happened early
     const isVSCodeFlow = typeof callback === 'string' && typeof nonce === 'string';
     if (isVSCodeFlow) {
         try {
            const errorCallbackUrl = new URL(callback);
            errorCallbackUrl.searchParams.set('error', 'Internal server error during login');
            if (nonce) errorCallbackUrl.searchParams.set('nonce', nonce);
            console.error(`VS Code login failed (internal error), redirecting to: ${errorCallbackUrl.toString()}`);
            return res.redirect(302, errorCallbackUrl.toString());
         } catch (urlError) {
              console.error("Failed to parse callback URL during error handling:", urlError);
              // Fallback if callback URL itself is invalid
               return res.status(500).json({ message: "Internal server error and failed to redirect back to VS Code." });
         }
    }
    // ------------------------------------------------------
    return res.status(500).json({ message: "Internal server error" });
  }
};
