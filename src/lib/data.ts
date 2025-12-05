
import type { Product, Category, Brand, Author, ProductType, HomepageContent, XeroxService, XeroxOption, XeroxOptionType, OrderSettings, Order, OrderStatus, Notification, PaperSample } from './types';
import { db } from './firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp, setDoc, writeBatch, runTransaction } from 'firebase/firestore';
import { getShops } from './shops';

export const categories: Category[] = [
    {
        id: 'cat-1',
        name: 'STATIONARY PRODUCTS',
        href: '/stationary',
        icon: 'Notebook',
        image: { src: '', alt: '', width: 96, height: 96 },
    },
    {
        id: 'cat-2',
        name: 'BOOK',
        href: '/books',
        icon: 'Book',
        image: { src: '', alt: '', width: 96, height: 96 },
    },
    {
        id: 'cat-3',
        name: 'XEROX',
        href: '/xerox',
        icon: 'Printer',
        image: { src: '', alt: '', width: 96, height: 96 },
    },
    {
        id: 'cat-4',
        name: 'ELECTRONIC KIT',
        href: '/electronics',
        icon: 'CircuitBoard',
        image: { src: '', alt: '', width: 96, height: 96 },
    }
]

const productsCollection = collection(db, 'products');
const brandsCollection = collection(db, 'brands');
const authorsCollection = collection(db, 'authors');
const productTypesCollection = collection(db, 'productTypes');
const homepageContentCollection = collection(db, 'homepageContent');
const xeroxServicesCollection = collection(db, 'xeroxServices');
const orderSettingsCollection = collection(db, 'orderSettings');
const ordersCollection = collection(db, 'orders');
const notificationsCollection = collection(db, 'notifications');
const paperSamplesCollection = collection(db, 'paperSamples');


// --- Paper Sample Functions ---
export const getPaperSamples = async (): Promise<PaperSample[]> => {
    try {
        const q = query(paperSamplesCollection, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaperSample));
    } catch (error) {
        console.error("Error getting paper samples: ", error);
        throw new Error("Failed to fetch paper samples.");
    }
};

export const addPaperSample = async (data: Omit<PaperSample, 'id' | 'createdAt'>): Promise<string> => {
    try {
        const docRef = await addDoc(paperSamplesCollection, {
            ...data,
            createdAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding paper sample: ", error);
        throw new Error("Failed to add paper sample.");
    }
};

export const updatePaperSample = async (id: string, data: Partial<Omit<PaperSample, 'id' | 'createdAt'>>): Promise<void> => {
    try {
        const sampleDoc = doc(db, 'paperSamples', id);
        await updateDoc(sampleDoc, data);
    } catch (error) {
        console.error("Error updating paper sample: ", error);
        throw new Error("Failed to update paper sample.");
    }
};

export const deletePaperSample = async (id: string): Promise<void> => {
    try {
        const sampleDoc = doc(db, 'paperSamples', id);
        await deleteDoc(sampleDoc);
    } catch (error) {
        console.error("Error deleting paper sample: ", error);
        throw new Error("Failed to delete paper sample.");
    }
};

// --- Xerox Form Option Collections ---
export const getXeroxOptionCollection = (type: XeroxOptionType) => {
    switch(type) {
        case 'paperType': return collection(db, 'paperTypes');
        case 'bindingType': return collection(db, 'bindingTypes');
        case 'laminationType': return collection(db, 'laminationTypes');
        default: throw new Error('Invalid Xerox option type');
    }
};

export const getHomepageContent = async (): Promise<HomepageContent | null> => {
    try {
        const docRef = doc(homepageContentCollection, 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as HomepageContent;
        }
        return null; // No content set yet
    } catch (error) {
        console.error("Error getting homepage content: ", error);
        throw new Error("Failed to fetch homepage content.");
    }
}

export const updateHomepageContent = async (content: HomepageContent): Promise<void> => {
    try {
        const docRef = doc(homepageContentCollection, 'main');
        await setDoc(docRef, content, { merge: true });
    } catch (error) {
        console.error("Error updating homepage content: ", error);
        throw new Error("Failed to update homepage content.");
    }
}


export const getProducts = async (category?: Product['category']): Promise<Product[]> => {
    try {
        let q;
        if (category) {
            q = query(productsCollection, where('category', '==', category), orderBy('createdAt', 'desc'));
        } else {
            q = query(productsCollection, orderBy('createdAt', 'desc'));
        }
        const querySnapshot = await getDocs(q);
        const products = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return { 
                id: doc.id, 
                ...data,
            } as Product;
        });
        return products;
    } catch (error) {
        console.error("Error getting products: ", error);
        throw new Error("Failed to fetch products.");
    }
}

export const getProductById = async (id: string): Promise<Product | null> => {
    try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
            } as Product;
        } else {
            console.log("No such document!");
            return null;
        }
    } catch (error) {
        console.error("Error getting product by ID: ", error);
        throw new Error("Failed to fetch product.");
    }
};

export const getBrands = async (category?: Brand['category']): Promise<Brand[]> => {
    try {
        const q = category 
            ? query(brandsCollection, where('category', '==', category), orderBy('name', 'asc'))
            : query(brandsCollection, orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand));
    } catch (error) {
        console.error("Error getting brands: ", error);
        throw new Error("Failed to fetch brands.");
    }
}

export const getAuthors = async (): Promise<Author[]> => {
    try {
        const q = query(authorsCollection, orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Author));
    } catch (error) {
        console.error("Error getting authors: ", error);
        throw new Error("Failed to fetch authors.");
    }
};

export const getProductTypes = async (category?: ProductType['category']): Promise<ProductType[]> => {
    try {
        const q = category 
            ? query(productTypesCollection, where('category', '==', category))
            : query(productTypesCollection, orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductType));
    } catch (error) {
        console.error("Error getting product types: ", error);
        throw new Error("Failed to fetch product types.");
    }
};


export const addProduct = async (productData: Omit<Product, 'id' | 'rating' | 'createdAt'>) => {
  const { ...rest } = productData;
  const newProductData = {
    ...rest,
    rating: Math.floor(Math.random() * 3) + 3, // 3 to 5 stars
    createdAt: serverTimestamp(),
    discountPrice: productData.discountPrice || null,
    imageNames: productData.imageNames || [],
  };

  try {
    const docRef = await addDoc(productsCollection, newProductData);
    const fullProduct = {
      ...newProductData,
      id: docRef.id,
    } as Product
    return fullProduct;
  } catch (error) {
    console.error("Error adding product: ", error);
    throw new Error("Failed to add product to database.");
  }
};

export const updateProduct = async (id: string, productData: Partial<Omit<Product, 'id' | 'rating' | 'createdAt'>>) => {
    const { ...rest } = productData;
    const updatedProductData = {
        ...rest,
        discountPrice: productData.discountPrice || null,
    };

    try {
        const productDoc = doc(db, 'products', id);
        await updateDoc(productDoc, updatedProductData);
    } catch (error) {
        console.error("Error updating product: ", error);
        throw new Error("Failed to update product in database.");
    }
};

export const deleteProduct = async (id: string) => {
    try {
        const productDoc = doc(db, 'products', id);
        await deleteDoc(productDoc);
    } catch (error) {
        console.error("Error deleting product: ", error);
        throw new Error("Failed to delete product from database.");
    }
}

export const addBrand = async (brandData: Omit<Brand, 'id' | 'createdAt' | 'category'>, category: Brand['category']) => {
    const newBrand = {
        ...brandData,
        category: category,
        createdAt: serverTimestamp(),
    }
    try {
        const docRef = await addDoc(brandsCollection, newBrand);
        return { ...newBrand, id: docRef.id } as Brand;
    } catch (error) {
        console.error("Error adding brand: ", error);
        throw new Error("Failed to add brand to database.");
    }
}

export const addAuthor = async (authorData: Omit<Author, 'id' | 'createdAt'>) => {
    const newAuthor = {
        ...authorData,
        createdAt: serverTimestamp(),
    };
    try {
        const docRef = await addDoc(authorsCollection, newAuthor);
        return { ...newAuthor, id: docRef.id } as Author;
    } catch (error) {
        console.error("Error adding author: ", error);
        throw new Error("Failed to add author to database.");
    }
};

export const addProductType = async (productTypeData: Omit<ProductType, 'id' | 'createdAt' | 'category'>, category: ProductType['category']) => {
    const newProductType = {
        ...productTypeData,
        category: category,
        createdAt: serverTimestamp(),
    }
    try {
        const docRef = await addDoc(productTypesCollection, newProductType);
        return { ...newProductType, id: docRef.id } as ProductType;
    } catch (error) {
        console.error("Error adding product type: ", error);
        throw new Error("Failed to add product type to database.");
    }
};

// Update and Delete functions for metadata

export const updateBrand = async (id: string, data: { name: string }): Promise<void> => {
    const brandDoc = doc(db, 'brands', id);
    await updateDoc(brandDoc, data);
};

export const deleteBrand = async (id: string): Promise<void> => {
    const brandDoc = doc(db, 'brands', id);
    await deleteDoc(brandDoc);
};

export const updateAuthor = async (id: string, data: { name: string }): Promise<void> => {
    const authorDoc = doc(db, 'authors', id);
    await updateDoc(authorDoc, data);
};

export const deleteAuthor = async (id: string): Promise<void> => {
    const authorDoc = doc(db, 'authors', id);
    await deleteDoc(authorDoc);
};

export const updateProductType = async (id: string, data: { name: string }): Promise<void> => {
    const productTypeDoc = doc(db, 'productTypes', id);
    await updateDoc(productTypeDoc, data);
};

export const deleteProductType = async (id: string): Promise<void> => {
    const productTypeDoc = doc(db, 'productTypes', id);
    await deleteDoc(productTypeDoc);
};

// Xerox Services Functions
export const getXeroxServices = async (): Promise<XeroxService[]> => {
    try {
        const q = query(xeroxServicesCollection, orderBy('order', 'asc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as XeroxService));
    } catch (error) {
        console.error("Error getting Xerox services: ", error);
        throw new Error("Failed to fetch Xerox services.");
    }
};

export const addXeroxService = async (serviceData: Omit<XeroxService, 'id' | 'createdAt'>) => {
  const newServiceData = {
    ...serviceData,
    discountPrice: serviceData.discountPrice || null,
    unit: serviceData.unit || "",
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(xeroxServicesCollection, newServiceData);
    return { ...newServiceData, id: docRef.id } as XeroxService;
  } catch (error) {
    console.error("Error adding Xerox service: ", error);
    throw new Error("Failed to add Xerox service to database.");
  }
};

export const updateXeroxService = async (id: string, serviceData: Partial<Omit<XeroxService, 'id' | 'createdAt'>>) => {
    const updatedServiceData = {
        ...serviceData,
        discountPrice: serviceData.discountPrice || null,
        unit: serviceData.unit || "",
    };
    try {
        const serviceDoc = doc(db, 'xeroxServices', id);
        await updateDoc(serviceDoc, updatedServiceData);
    } catch (error) {
        console.error("Error updating Xerox service: ", error);
        throw new Error("Failed to update Xerox service in database.");
    }
};

export const deleteXeroxService = async (id: string) => {
    try {
        const serviceDoc = doc(db, 'xeroxServices', id);
        await deleteDoc(serviceDoc);
    } catch (error) {
        console.error("Error deleting Xerox service: ", error);
        throw new Error("Failed to delete Xerox service from database.");
    }
};

export const updateXeroxServiceOrder = async (updates: {id: string, order: number}[]) => {
    const batch = writeBatch(db);
    updates.forEach(update => {
        const docRef = doc(db, 'xeroxServices', update.id);
        batch.update(docRef, { order: update.order });
    });
    try {
        await batch.commit();
    } catch (error) {
        console.error("Error updating xerox service order: ", error);
        throw new Error("Failed to update service order.");
    }
}


// --- Xerox Form Option Functions ---

export const getXeroxOptions = async (type: XeroxOptionType): Promise<XeroxOption[]> => {
    try {
        const collectionRef = getXeroxOptionCollection(type);
        const q = type === 'paperType' 
            ? query(collectionRef, orderBy('order', 'asc'))
            : query(collectionRef, orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as XeroxOption));
    } catch (error) {
        console.error(`Error getting Xerox options for ${type}: `, error);
        throw new Error(`Failed to fetch Xerox options for ${type}.`);
    }
};

export const addXeroxOption = async (type: XeroxOptionType, optionData: Partial<Omit<XeroxOption, 'id' | 'createdAt'>>): Promise<XeroxOption> => {
  const newOptionData: any = { // Use any to build the object dynamically
    name: optionData.name || '',
    createdAt: serverTimestamp(),
  };

  if (type === 'paperType') {
    newOptionData.priceBw = optionData.priceBw || 0;
    newOptionData.priceColor = optionData.priceColor || 0;
    newOptionData.order = optionData.order || 0;
    newOptionData.colorOptionIds = optionData.colorOptionIds || [];
    newOptionData.formatTypeIds = optionData.formatTypeIds || [];
    newOptionData.printRatioIds = optionData.printRatioIds || [];
    newOptionData.bindingTypeIds = optionData.bindingTypeIds || [];
    newOptionData.laminationTypeIds = optionData.laminationTypeIds || [];
  } else {
    newOptionData.price = optionData.price || 0;
  }

  try {
    const collectionRef = getXeroxOptionCollection(type);
    const docRef = await addDoc(collectionRef, newOptionData);
    return { ...newOptionData, id: docRef.id } as XeroxOption;
  } catch (error) {
    console.error(`Error adding Xerox option to ${type}: `, error);
    throw new Error(`Failed to add Xerox option to ${type}.`);
  }
};


export const updateXeroxOption = async (type: XeroxOptionType, id: string, optionData: Partial<Omit<XeroxOption, 'id' | 'createdAt'>>): Promise<void> => {
    try {
        const collectionRef = getXeroxOptionCollection(type);
        const optionDoc = doc(collectionRef, id);
        await updateDoc(optionDoc, optionData);
    } catch (error) {
        console.error(`Error updating Xerox option in ${type}: `, error);
        throw new Error(`Failed to update Xerox option in ${type}.`);
    }
};

export const updatePaperTypeOrder = async (updates: {id: string, order: number}[]) => {
    const batch = writeBatch(db);
    updates.forEach(update => {
        const docRef = doc(db, 'paperTypes', update.id);
        batch.update(docRef, { order: update.order });
    });
    try {
        await batch.commit();
    } catch (error) {
        console.error("Error updating paper type order: ", error);
        throw new Error("Failed to update paper type order.");
    }
};


export const deleteXeroxOption = async (type: XeroxOptionType, id: string): Promise<void> => {
    try {
        const collectionRef = getXeroxOptionCollection(type);
        const optionDoc = doc(collectionRef, id);
        await deleteDoc(optionDoc);
    } catch (error) {
        console.error(`Error deleting Xerox option from ${type}: `, error);
        throw new Error(`Failed to delete Xerox option from ${type}.`);
    }
};

// --- Order Settings Functions ---
export const getOrderSettings = async (): Promise<OrderSettings> => {
  try {
    const docRef = doc(orderSettingsCollection, 'config');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as OrderSettings;
    }
    // Return default values if not set
    return {
      itemDeliveryCharge: 0,
      minItemOrderForFreeDelivery: 0,
      minXeroxOrderPrice: 0,
      xeroxDeliveryCharge: 0,
    };
  } catch (error) {
    console.error("Error getting order settings: ", error);
    throw new Error("Failed to fetch order settings.");
  }
};

export const updateOrderSettings = async (settings: Partial<OrderSettings>): Promise<void> => {
  try {
    const docRef = doc(orderSettingsCollection, 'config');
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    console.error("Error updating order settings: ", error);
    throw new Error("Failed to update order settings.");
  }
};

// --- Order Functions ---
export const createOrder = async (orderData: Omit<Order, 'id' | 'createdAt' | 'tracking'>): Promise<string> => {
    try {
        const now = new Date().toISOString();
        const docRef = await addDoc(ordersCollection, {
            ...orderData,
            createdAt: serverTimestamp(),
            tracking: {
              ordered: now,
              confirmed: null,
              packed: null,
              shipped: null,
              delivered: null,
              expectedDelivery: null
            }
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating order:", error);
        throw new Error("Could not place order.");
    }
};

export const getMyOrders = async (userId: string): Promise<Order[]> => {
    try {
        const q = query(ordersCollection, where('userId', '==', userId), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    } catch (error) {
        console.error("Error fetching user orders:", error);
        throw new Error("Could not fetch order history.");
    }
};

export const getOrdersByGroupId = async (groupId: string): Promise<Order[]> => {
    try {
        const q = query(ordersCollection, where('groupId', '==', groupId), orderBy('createdAt', 'asc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    } catch (error) {
        console.error("Error fetching orders by group ID:", error);
        throw new Error("Could not fetch orders for this group.");
    }
};


export const getAllOrders = async (): Promise<Order[]> => {
    try {
        const q = query(ordersCollection, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    } catch (error) {
        console.error("Error fetching all orders:", error);
        throw new Error("Could not fetch all orders.");
    }
}

export const getOrdersBySeller = async (sellerId: string): Promise<Order[]> => {
    try {
        const q = query(ordersCollection, where('sellerId', '==', sellerId), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    } catch (error) {
        console.error("Error fetching seller orders:", error);
        throw new Error("Could not fetch orders for this shop.");
    }
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus, reason?: string): Promise<void> => {
    try {
        const orderDocRef = doc(db, 'orders', orderId);
        
        await runTransaction(db, async (transaction) => {
            const orderDoc = await transaction.get(orderDocRef);
            if (!orderDoc.exists()) {
                throw new Error("Order not found!");
            }
            
            const orderData = orderDoc.data() as Order;
            const shopDocRef = doc(db, 'shops', orderData.sellerId);
            const shopDoc = await transaction.get(shopDocRef);
            const shopData = shopDoc.exists() ? shopDoc.data() : null;

            const updates: { [key: string]: any } = { status };
            const now = new Date().toISOString();
            
            switch(status) {
              case 'Processing': updates['tracking.confirmed'] = now; break;
              case 'Packed': updates['tracking.packed'] = now; break;
              case 'Shipped': updates['tracking.shipped'] = now; break;
              case 'Out for Delivery': updates['tracking.outForDelivery'] = now; break;
              case 'Delivered': updates['tracking.delivered'] = now; break;
              case 'Return Requested': 
                updates['tracking.returnRequested'] = now; 
                updates['returnReason'] = reason;
                break;
              case 'Return Approved': updates['tracking.returnApproved'] = now; break;
              case 'Out for Pickup': updates['tracking.outForPickup'] = now; break;
              case 'Picked Up': updates['tracking.pickedUp'] = now; break;
              case 'Return Completed': updates['tracking.returnCompleted'] = now; break;
              case 'Return Rejected': 
                updates['rejectionReason'] = reason;
                break;
              case 'Replacement Issued': updates['tracking.replacementIssued'] = now; break;
              case 'Rejected':
                updates['rejectionReason'] = reason;
                break;
            }

            transaction.update(orderDocRef, updates);
            
            // Create notification for customer
            const notificationDocRef = doc(notificationsCollection);
            const notification: Omit<Notification, 'id'> = {
                userId: orderData.userId,
                orderId: orderId,
                title: `Order Status Updated: ${status}`,
                message: `Your order for "${orderData.productName}" is now ${status}.` + (reason ? ` Reason: ${reason}` : ''),
                sellerMobileNumbers: shopData?.mobileNumbers || [],
                isRead: false,
                createdAt: serverTimestamp(),
            };
            transaction.set(notificationDocRef, notification);
        });

    } catch (error) {
        console.error("Error updating order status:", error);
        throw new Error("Failed to update order status.");
    }
};

export const cancelOrder = async (orderId: string, reason: string): Promise<void> => {
    try {
        const orderDocRef = doc(db, 'orders', orderId);
        await updateDoc(orderDocRef, {
            status: "Cancelled",
            cancellationReason: reason,
        });
        // You might want to send a notification to the seller here as well
    } catch (error) {
        console.error("Error cancelling order:", error);
        throw new Error("Failed to cancel order.");
    }
};

// --- Notification Functions ---
export const getNotificationsForUser = async (userId: string): Promise<Notification[]> => {
    try {
        const q = query(notificationsCollection, where('userId', '==', userId), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
    } catch (error) {
        console.error("Error getting notifications:", error);
        throw new Error("Failed to fetch notifications.");
    }
};

export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
    try {
        const notificationDoc = doc(db, 'notifications', notificationId);
        await updateDoc(notificationDoc, { isRead: true });
        return true;
    } catch (error) {
        console.error("Error marking notification as read:", error);
        return false;
    }
};

// --- Return Function ---
export const requestReturn = async (orderId: string, reason: string, returnType: 'refund' | 'replacement'): Promise<void> => {
  try {
    const orderDoc = doc(db, "orders", orderId);
    await updateDoc(orderDoc, {
      status: "Return Requested",
      returnReason: reason,
      returnType: returnType,
      "tracking.returnRequested": new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error requesting return:", error);
    throw new Error("Failed to submit return request.");
  }
};

export const approveOrderReturn = async (orderId: string): Promise<void> => {
    await updateOrderStatus(orderId, "Return Approved");
};

export const rejectOrderReturn = async (orderId: string, reason: string): Promise<void> => {
    await updateOrderStatus(orderId, "Return Rejected", reason);
};

export const issueReplacement = async (orderId: string): Promise<void> => {
    await updateOrderStatus(orderId, "Replacement Issued");
}
