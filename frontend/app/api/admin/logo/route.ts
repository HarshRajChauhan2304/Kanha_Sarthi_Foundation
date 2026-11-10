import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase";
import { getConfig, saveConfig } from "@/lib/config-storage";
import navbarFallback from "@/data/navbar.json";
import footerFallback from "@/data/footer.json";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("logo") as File | null;
    if (!file) {
      return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
    }
    // Validate file type (allow image only)
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ success: false, message: "Invalid file type" }, { status: 400 });
    }
    // Optional size limit (e.g., 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, message: "File too large (max 5MB)" }, { status: 400 });
    }
    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let logoUrl = "/logo.png";

    // 1. Upload to Supabase Storage
    try {
      const filename = `logo_${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("uploads")
        .upload(filename, buffer, {
          contentType: file.type || "image/png",
          upsert: true
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabaseAdmin.storage
          .from("uploads")
          .getPublicUrl(filename);

        if (publicUrlData?.publicUrl) {
          logoUrl = publicUrlData.publicUrl;

          // Update navbar config with new logo
          try {
            const currentNav = await getConfig<any>("navbar", navbarFallback, "navbar.json");
            currentNav.logo = logoUrl;
            await saveConfig("navbar", currentNav, "navbar.json");
          } catch (navErr) {
            console.warn("Failed to update navbar config with new logo:", navErr);
          }

          // Update footer config with new logo
          try {
            const currentFooter = await getConfig<any>("footer", footerFallback, "footer.json");
            currentFooter.logo = logoUrl;
            await saveConfig("footer", currentFooter, "footer.json");
          } catch (footerErr) {
            console.warn("Failed to update footer config with new logo:", footerErr);
          }
        }
      }
    } catch (supaErr) {
      console.warn("Supabase logo upload warning:", supaErr);
    }

    // 2. Safe local write fallback (for local dev)
    try {
      const possiblePublicDirs = [
        path.join(process.cwd(), "public"),
        path.join(process.cwd(), "frontend", "public")
      ];
      for (const pDir of possiblePublicDirs) {
        if (fs.existsSync(pDir)) {
          fs.writeFileSync(path.join(pDir, "logo.png"), buffer);
          break;
        }
      }
    } catch (fsErr) {
      // EROFS on read-only environments like Vercel is expected and safe to ignore
      console.warn("Local fs write skipped (serverless environment):", fsErr);
    }

    return NextResponse.json({ success: true, message: "Logo updated", url: logoUrl });
  } catch (error: any) {
    console.error("Error uploading logo:", error);
    return NextResponse.json({ success: false, message: error?.message || "Server error" }, { status: 500 });
  }
}
