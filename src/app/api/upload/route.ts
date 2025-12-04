
import { NextRequest, NextResponse } from "next/server";
import { getDriveClient } from "@/lib/googleDrive";
import fs from "fs";
import path from "path";
import os from "os";
import { Readable } from "stream";

export async function POST(req: NextRequest) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const tempFilePath = path.join(os.tmpdir(), file.name);

    try {
        // Stream the file to a temporary location to avoid loading it all into memory
        const readableStream = file.stream();
        const writeStream = fs.createWriteStream(tempFilePath);
        
        // Use a promise to wait for the stream to finish writing
        await new Promise((resolve, reject) => {
            Readable.fromWeb(readableStream as any).pipe(writeStream)
                .on('finish', resolve)
                .on('error', reject);
        });

        const drive = getDriveClient();
        
        const fileMetadata: any = { name: file.name };

        const media = {
            mimeType: file.type,
            body: fs.createReadStream(tempFilePath),
        };

        const uploadResponse = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: "id, webViewLink",
        });

        const fileId = uploadResponse.data.id;
        if (!fileId) {
            throw new Error("File ID not found after upload.");
        }

        // Make file public (anyone with the link can view)
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: "reader",
                type: "anyone",
            },
        });

        // Use the direct download URL format
        const publicUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        return NextResponse.json({
            success: true,
            fileId: fileId,
            url: publicUrl,
        }, { status: 200 });

    } catch (e: any) {
        console.error('Error in POST /api/upload:', e);
        return NextResponse.json({ error: "Upload failed", details: e.message }, { status: 500 });
    } finally {
        // Clean up the temporary file
        try {
            if (fs.existsSync(tempFilePath)) {
                await fs.promises.unlink(tempFilePath);
            }
        } catch (unlinkError) {
            console.error("Failed to delete temporary file:", tempFilePath, unlinkError);
        }
    }
}
