
'use server';

import { google } from 'googleapis';
import { getAllOrders } from '@/lib/data';
import { Order, OrderStatus } from '@/lib/types';

function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// Helper to format bytes
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export async function getDriveUsageAction() {
  try {
    const drive = getDriveClient();
    const response = await drive.about.get({
      fields: 'storageQuota',
    });
    const storageQuota = response.data.storageQuota;
    return {
      limit: Number(storageQuota?.limit) || 0,
      usage: Number(storageQuota?.usage) || 0,
      usageInDrive: Number(storageQuota?.usageInDrive) || 0,
    };
  } catch (error: any) {
    console.error('Error fetching Drive usage:', error);
    throw new Error('Could not fetch Google Drive usage data. Check server logs and environment variables.');
  }
}

const getFileIdFromUrl = (url: string): string | null => {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'drive.google.com' && urlObj.pathname.startsWith('/uc')) {
            return urlObj.searchParams.get('id');
        }
        return null;
    } catch (e) {
        return null;
    }
};

const getOrderStatusCategory = (status: OrderStatus): 'Active' | 'Delivered' | 'Cancelled/Rejected' => {
    const activeStatuses: OrderStatus[] = ["Pending Confirmation", "Processing", "Packed", "Shipped", "Out for Delivery", "Return Requested", "Return Approved", "Out for Pickup", "Picked Up", "Replacement Issued"];
    const deliveredStatuses: OrderStatus[] = ["Delivered", "Return Completed"];
    
    if (activeStatuses.includes(status)) return 'Active';
    if (deliveredStatuses.includes(status)) return 'Delivered';
    return 'Cancelled/Rejected';
};

export async function getDriveFilesAction(): Promise<{ error?: string; files: any[] }> {
  const folderId = process.env.GOOGLE_FOLDER_ID;
  if (!folderId) {
    return {
      error: 'GOOGLE_FOLDER_ID environment variable is not set.',
      files: [],
    };
  }
  
  const query = `trashed=false and '${folderId}' in parents`;
  
  try {
    const drive = getDriveClient();
    const [driveResponse, allOrders] = await Promise.all([
      drive.files.list({
        q: query,
        fields: 'files(id, name, size, createdTime, webViewLink)',
        orderBy: 'createdTime desc',
        pageSize: 100,
      }),
      getAllOrders()
    ]);
    
    const fileIdToOrderStatus = new Map<string, OrderStatus>();
    allOrders.forEach(order => {
        if (order.category === 'xerox' && order.productImage) {
            const fileId = getFileIdFromUrl(order.productImage);
            if (fileId) {
                fileIdToOrderStatus.set(fileId, order.status);
            }
        }
    });

    const files = (driveResponse.data.files || []).map((file) => {
        const orderStatus = file.id ? fileIdToOrderStatus.get(file.id) : undefined;
        let statusCategory: 'Active' | 'Delivered' | 'Cancelled/Rejected' | 'Unused' | null = null;
        if(orderStatus) {
            statusCategory = getOrderStatusCategory(orderStatus);
        } else {
            statusCategory = 'Unused';
        }
        
        return {
          id: file.id || '',
          name: file.name || 'Untitled',
          size: file.size ? formatBytes(Number(file.size)) : 'N/A',
          createdTime: file.createdTime || new Date().toISOString(),
          webViewLink: file.webViewLink || '',
          orderStatus: statusCategory
        }
    });

    return { files };
  } catch (error: any) {
    console.error('Error fetching Drive files:', error);
    throw new Error('Could not fetch files from Google Drive. Check server logs and environment variables.');
  }
}

export async function deleteDriveFileAction(fileId: string) {
  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting Drive file:', error);
    throw new Error('Could not delete file from Google Drive.');
  }
}

export async function deleteDriveFilesAction(fileIds: string[]) {
    try {
        const drive = getDriveClient();
        const promises = fileIds.map(fileId => drive.files.delete({ fileId }));
        await Promise.all(promises);
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting multiple Drive files:', error);
        throw new Error('Could not delete all selected files from Google Drive. ' + error.message);
    }
}
