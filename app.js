// =========================================================
// نظام المبيعات والمشتريات
// app.js
// =========================================================
//
// النسخة الجديدة
// Firebase + Firestore
// RTL Arabic
//
// =========================================================


// =========================================================
// Firebase
// =========================================================

import {
    db,
    auth,
    functions
} from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    httpsCallable
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";

import {
    collection,
    getDocs,
    getDoc,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// =========================================================
// المتغيرات العامة
// =========================================================

let systemData = {

    sales: [],

    purchases: [],

    expenses: [],

    products: [],

    customers: [],

    suppliers: [],

    employees: [],

    investors: [],

    settings: {

        businessName: "",

        businessPhone: "",

        baseCurrency: "EGP"

    }

};


let currentPage = "dashboard";

let currentUser = null; // ملف المستخدم الحالي من Firestore (يحتوي role و permissions)

let firebaseConnected = false;


// =========================================================
// أسماء مجموعات Firestore
// =========================================================

const COLLECTIONS = {

    sales: "sales",

    purchases: "purchases",

    expenses: "expenses",

    products: "products",

    customers: "customers",

    suppliers: "suppliers",

    employees: "employees",

    investors: "investors"

};


// =========================================================
// عند تحميل الصفحة
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        initializeInterface();

        const loginButton =
            document.getElementById("loginButton");

        if (loginButton) {

            loginButton.addEventListener(
                "click",
                loginUser
            );

        }


        // -----------------------------------------------
        // مراقبة حالة تسجيل الدخول (تحافظ على الجلسة)
        // Firebase بيحتفظ بالجلسة تلقائيًا بالمتصفح،
        // فهاي الدالة بتنفّذ سواء كان الدخول جديد أو
        // جلسة محفوظة من قبل (بعد تحديث الصفحة).
        // -----------------------------------------------

        onAuthStateChanged(
            auth,
            async function (user) {

                const loginScreen =
                    document.getElementById(
                        "loginScreen"
                    );

                if (user) {

                    if (loginScreen) {

                        loginScreen.style.display =
                            "none";

                    }

                    await ensureUserProfile();

                    await loadCurrentUserProfile();


                    if (!currentUser) {

                        // حساب مسجّل دخول بـ Firebase بس
                        // ما إله ملف صلاحيات بقاعدة البيانات
                        // (لازم المدير يضيفه من صفحة العمال)

                        showToast(
                            "حسابك غير مفعّل بالنظام. تواصل مع المدير لإضافة صلاحياتك.",
                            "error"
                        );

                        await signOut(
                            auth
                        );

                        return;

                    }


                    if (currentUser.active === false) {

                        showToast(
                            "تم إيقاف هذا الحساب. تواصل مع المدير.",
                            "error"
                        );

                        currentUser = null;

                        await signOut(
                            auth
                        );

                        return;

                    }


                    await initializeFirebase();

                } else {

                    currentUser = null;

                    if (loginScreen) {

                        loginScreen.style.display =
                            "flex";

                    }

                    const app =
                        document.getElementById(
                            "app"
                        );

                    if (app) {

                        app.classList.add(
                            "hidden"
                        );

                    }

                    const loadingScreenEl =
                        document.getElementById(
                            "loadingScreen"
                        );

                    if (loadingScreenEl) {

                        loadingScreenEl.classList.add(
                            "hidden"
                        );

                    }

                }

            }
        );

    }
);

// =========================================================
// تهيئة الواجهة
// =========================================================

function initializeInterface() {

    updateCurrentDate();

    setDefaultDates();

    showPage("dashboard");

}


// =========================================================
// التاريخ الحالي
// =========================================================

function updateCurrentDate() {

    const element =
        document.getElementById("currentDate");

    if (!element) return;

    const now = new Date();

    element.textContent =
        now.toLocaleDateString(
            "ar-EG",
            {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        );

}


// =========================================================
// التواريخ الافتراضية
// =========================================================

function setDefaultDates() {

    const today =
        new Date()
            .toISOString()
            .split("T")[0];


    const dateFrom =
        document.getElementById("reportDateFrom");

    const dateTo =
        document.getElementById("reportDateTo");


    if (dateFrom) {

        dateFrom.value = today;

    }


    if (dateTo) {

        dateTo.value = today;

    }

}


// =========================================================
// Firebase
// =========================================================

async function initializeFirebase() {

    setConnectionStatus(
        "warning",
        "جاري الاتصال..."
    );


    try {

        await loadAllData();

        firebaseConnected = true;


        setConnectionStatus(
            "online",
            "متصل بقاعدة البيانات"
        );


        hideLoadingScreen();

        refreshCurrentPage();


    } catch (error) {

        console.error(
            "Firebase initialization error:",
            error
        );


        firebaseConnected = false;


        setConnectionStatus(
            "offline",
            "تعذر الاتصال"
        );


        showToast(
            "تعذر الاتصال بقاعدة البيانات. راجع إعدادات Firebase.",
            "error"
        );


        hideLoadingScreen();

    }

}
// =========================================================
// تسجيل الدخول
// =========================================================

async function loginUser() {

    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    const message =
        document.getElementById("loginMessage");

    if (!email || !password) {

        message.textContent =
            "من فضلك أدخل البريد الإلكتروني وكلمة المرور.";

        return;
    }

    try {

        message.textContent =
            "جاري تسجيل الدخول...";

        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        message.textContent =
            "";

        // ملاحظة: onAuthStateChanged هو يلي بيتكفل
        // بإخفاء شاشة الدخول وتحميل البيانات، عشان
        // نفس المنطق يشتغل سواء كان دخول جديد أو
        // جلسة محفوظة من قبل.

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        message.textContent =
            "البريد الإلكتروني أو كلمة المرور غير صحيحة.";

    }

}


// =========================================================
// تسجيل الخروج
// =========================================================

async function logoutUser() {

    try {

        await signOut(
            auth
        );

        showToast(
            "تم تسجيل الخروج",
            "success"
        );

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        showToast(
            "تعذر تسجيل الخروج",
            "error"
        );

    }

}
// =========================================================
// إنشاء سجل المستخدم في Firestore
// =========================================================

async function ensureUserProfile() {

    if (!auth.currentUser) return;

    const userId =
        auth.currentUser.uid;

    const userRef =
        doc(
            db,
            "users",
            userId
        );

    const userSnapshot =
        await getDoc(
            userRef
        );

    if (userSnapshot.exists()) return;


    // -----------------------------------------
    // تحقق: هل يوجد أي مستخدم آخر مسجّل بالنظام
    // مسبقًا؟ (منع أي حساب Firebase Auth جديد من
    // تنصيب نفسه مديرًا تلقائيًا إذا كان في مدير
    // أو موظفين مسجّلين أصلًا)
    // -----------------------------------------

    const existingUsersSnapshot =
        await getDocs(
            query(
                collection(
                    db,
                    "users"
                ),
                limit(1)
            )
        );

    if (!existingUsersSnapshot.empty) {

        console.warn(
            "لا يوجد ملف مستخدم مرتبط بهذا الحساب، ولا يوجد ترقية تلقائية لأنه يوجد مستخدمون آخرون بالنظام."
        );

        return;

    }


    // ما في ولا مستخدم بالنظام أبدًا -> هاد أول
    // حساب يسجّل دخول، فمنعتبره المدير الأساسي

    await setDoc(
        userRef,
        {

            uid: userId,

            email:
                auth.currentUser.email || "",

            name: "مدير النظام",

            role: "admin",

            permissions: {

                dashboard: true,

                sales: true,

                purchases: true,

                expenses: true,

                inventory: true,

                customers: true,

                suppliers: true,

                employees: true,

                investors: true,

                reports: true,

                analysis: true,

                settings: true

            },

            active: true,

            createdAt:
                serverTimestamp(),

            updatedAt:
                serverTimestamp()

        }
    );


    // قفل البوتستراب - بعد هاد السطر ما حدا تاني
    // يقدر ينشئ نفسه مديرًا تلقائيًا (راجع firestore.rules)

    try {

        await setDoc(
            doc(
                db,
                "meta",
                "bootstrap"
            ),
            {

                initialized: true,

                adminUid: userId,

                at:
                    serverTimestamp()

            }
        );

    } catch (error) {

        console.error(
            "تعذر إنشاء قفل البوتستراب:",
            error
        );

    }


    console.log(
        "تم إنشاء مستخدم المدير"
    );

}


// =========================================================
// تحميل ملف المستخدم الحالي (الدور + الصلاحيات)
// =========================================================

async function loadCurrentUserProfile() {

    if (!auth.currentUser) {

        currentUser = null;

        return;

    }

    try {

        const userRef =
            doc(
                db,
                "users",
                auth.currentUser.uid
            );

        const userSnapshot =
            await getDoc(
                userRef
            );

        currentUser =
            userSnapshot.exists()
            ?
            userSnapshot.data()
            :
            null;

    } catch (error) {

        console.error(
            "loadCurrentUserProfile:",
            error
        );

        currentUser = null;

    }

    applyUserPermissions();

}


// =========================================================
// هل يملك المستخدم الحالي صلاحية صفحة معينة؟
// =========================================================

function hasPermission(
    pageName
) {

    if (!currentUser) return false;

    if (currentUser.active === false) return false;

    if (currentUser.role === "admin") return true;

    return !!(
        currentUser.permissions &&
        currentUser.permissions[pageName]
    );

}


// =========================================================
// تطبيق الصلاحيات على الشريط الجانبي
// =========================================================

const ALL_PAGE_NAMES = [

    "dashboard",
    "sales",
    "purchases",
    "expenses",
    "inventory",
    "customers",
    "suppliers",
    "employees",
    "investors",
    "reports",
    "analysis",
    "settings"

];

function applyUserPermissions() {

    document.querySelectorAll(
        ".nav-item[data-page]"
    ).forEach(
        item => {

            const page =
                item.dataset.page;

            if (hasPermission(page)) {

                item.classList.remove(
                    "hidden"
                );

            } else {

                item.classList.add(
                    "hidden"
                );

            }

        }
    );


    const nameLabel =
        document.getElementById(
            "currentUserName"
        );

    if (nameLabel && currentUser) {

        nameLabel.textContent =
            currentUser.name ||
            currentUser.email ||
            "";

    }


    const createAccountBtn =
        document.getElementById(
            "createEmployeeAccountBtn"
        );

    if (createAccountBtn) {

        createAccountBtn.classList.toggle(
            "hidden",
            !currentUser ||
            currentUser.role !== "admin"
        );

    }


    // لو الصفحة الحالية غير مسموح بها،
    // ننقل المستخدم لأول صفحة يملك صلاحية عليها

    if (!hasPermission(currentPage)) {

        const firstAllowed =
            ALL_PAGE_NAMES.find(
                page =>
                    hasPermission(page)
            );

        if (firstAllowed) {

            showPage(
                firstAllowed
            );

        } else {

            showToast(
                "لا تملك صلاحية الوصول لأي صفحة بالنظام. تواصل مع المدير.",
                "error"
            );

        }

    }

}


// =========================================================
// حالة الاتصال
// =========================================================

function setConnectionStatus(
    status,
    text
) {

    const dot =
        document.getElementById(
            "firebaseStatusDot"
        );


    const label =
        document.getElementById(
            "firebaseStatusText"
        );


    const databaseDot =
        document.getElementById(
            "databaseStatusDot"
        );


    const databaseText =
        document.getElementById(
            "databaseStatusText"
        );


    if (dot) {

        dot.classList.remove(
            "offline",
            "warning"
        );


        if (status === "offline") {

            dot.classList.add(
                "offline"
            );

        }


        if (status === "warning") {

            dot.classList.add(
                "warning"
            );

        }

    }


    if (databaseDot) {

        databaseDot.classList.remove(
            "offline",
            "warning"
        );


        if (status === "offline") {

            databaseDot.classList.add(
                "offline"
            );

        }


        if (status === "warning") {

            databaseDot.classList.add(
                "warning"
            );

        }

    }


    if (label) {

        label.textContent = text;

    }


    if (databaseText) {

        databaseText.textContent = text;

    }

}


// =========================================================
// تحميل جميع البيانات
// =========================================================

async function loadAllData() {

    systemData.sales =
        await getCollectionData(
            COLLECTIONS.sales
        );


    systemData.purchases =
        await getCollectionData(
            COLLECTIONS.purchases
        );


    systemData.expenses =
        await getCollectionData(
            COLLECTIONS.expenses
        );


    systemData.products =
        await getCollectionData(
            COLLECTIONS.products
        );


    systemData.customers =
        await getCollectionData(
            COLLECTIONS.customers
        );


    systemData.suppliers =
        await getCollectionData(
            COLLECTIONS.suppliers
        );


    systemData.employees =
        await getCollectionData(
            COLLECTIONS.employees
        );


    systemData.investors =
        await getCollectionData(
            COLLECTIONS.investors
        );


    await loadSettings();

}


// =========================================================
// جلب Collection
// =========================================================

async function getCollectionData(
    collectionName
) {

    const snapshot =
        await getDocs(
           collection(
                db,
                collectionName
            )
        );


    return snapshot.docs.map(
        item => {

            return {

                id: item.id,

                ...item.data()

            };

        }
    );

}


// =========================================================
// الإعدادات
// =========================================================

async function loadSettings() {

    try {

        const settingsRef =
            doc(
                db,
                "settings",
                "general"
            );


        const snapshot =
            await getDoc(
                settingsRef
            );


        if (snapshot.exists()) {

            systemData.settings = {

                ...systemData.settings,

                ...snapshot.data()

            };

        }

    } catch (error) {

        console.error(
            "loadSettings:",
            error
        );

    }

}


// =========================================================
// حفظ إعدادات النظام
// =========================================================

async function saveSettings() {

    try {

        const businessName =
            document.getElementById(
                "businessName"
            )?.value.trim() || "";


        const businessPhone =
            document.getElementById(
                "businessPhone"
            )?.value.trim() || "";


        const baseCurrency =
            document.getElementById(
                "baseCurrency"
            )?.value || "EGP";


        const settings = {

            businessName,

            businessPhone,

            baseCurrency,

            updatedAt:
                serverTimestamp()

        };


        await setDoc(
            doc(
                db,
                "settings",
                "general"
            ),
            settings,
            {
                merge: true
            }
        );


        systemData.settings = {

            businessName,

            businessPhone,

            baseCurrency

        };


        showToast(
            "تم حفظ الإعدادات",
            "success"
        );


    } catch (error) {

        console.error(
            "saveSettings:",
            error
        );


        showToast(
            "تعذر حفظ الإعدادات",
            "error"
        );

    }

}


// =========================================================
// إظهار الصفحة
// =========================================================

function showPage(
    pageName
) {

    // نتحقق من الصلاحية فقط بعد ما ينحمّل ملف
    // المستخدم (قبل هيك، أثناء إعداد الواجهة الأولي
    // قبل تسجيل الدخول، ما في داعي للمنع)

    if (
        currentUser &&
        !hasPermission(pageName)
    ) {

        showToast(
            "ليس لديك صلاحية الوصول لهذه الصفحة",
            "warning"
        );

        return;

    }


    const pages =
        document.querySelectorAll(
            ".page"
        );


    pages.forEach(
        page => {

            page.classList.remove(
                "active-page"
            );

        }
    );


    const target =
        document.getElementById(
            `page-${pageName}`
        );


    if (!target) return;


    target.classList.add(
        "active-page"
    );


    currentPage =
        pageName;


    updateNavigation(
        pageName
    );


    updatePageTitle(
        pageName
    );


    closeSidebar();


    refreshCurrentPage();

}


// =========================================================
// تحديث القائمة الجانبية
// =========================================================

function updateNavigation(
    pageName
) {

    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );


    navItems.forEach(
        item => {

            item.classList.remove(
                "active"
            );


            if (
                item.dataset.page ===
                pageName
            ) {

                item.classList.add(
                    "active"
                );

            }

        }
    );

}


// =========================================================
// عناوين الصفحات
// =========================================================

function updatePageTitle(
    pageName
) {

    const titles = {

        dashboard:
            "الرئيسية",

        sales:
            "المبيعات",

        purchases:
            "المشتريات",

        expenses:
            "المصروفات",

        inventory:
            "المخزون",

        customers:
            "العملاء",

        suppliers:
            "الموردون",

        employees:
            "العمال والرواتب",

        investors:
            "المستثمرون",

        reports:
            "التقارير",

        analysis:
            "التحليل",

        settings:
            "الإعدادات"

    };


    const element =
        document.getElementById(
            "pageTitle"
        );


    if (element) {

        element.textContent =
            titles[pageName] ||
            "نظام الإدارة";

    }

}


// =========================================================
// Sidebar
// =========================================================

function toggleSidebar() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );


    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    if (!sidebar) return;


    sidebar.classList.toggle(
        "open"
    );


    if (overlay) {

        overlay.classList.toggle(
            "hidden"
        );

    }

}


function closeSidebar() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );


    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    if (sidebar) {

        sidebar.classList.remove(
            "open"
        );

    }


    if (overlay) {

        overlay.classList.add(
            "hidden"
        );

    }

}


// =========================================================
// شاشة التحميل
// =========================================================

function hideLoadingScreen() {

    const screen =
        document.getElementById(
            "loadingScreen"
        );


    const app =
        document.getElementById(
            "app"
        );


    if (screen) {

        screen.classList.add(
            "hidden"
        );

    }


    if (app) {

        app.classList.remove(
            "hidden"
        );

    }

}


// =========================================================
// تحديث الصفحة الحالية
// =========================================================

function refreshCurrentPage() {

    switch (currentPage) {

        case "dashboard":

            renderDashboard();

            break;


        case "sales":

            renderSales();

            break;


        case "purchases":

            renderPurchases();

            break;


        case "expenses":

            renderExpenses();

            break;


        case "inventory":

            renderInventory();

            break;


        case "customers":

            renderCustomers();

            break;


        case "suppliers":

            renderSuppliers();

            break;


        case "employees":

            renderEmployees();

            break;


        case "investors":

            renderInvestors();

            break;


        case "reports":

            break;


        case "analysis":

            break;


        case "settings":

            renderSettings();

            break;

    }

}


// =========================================================
// Dashboard
// =========================================================

function renderDashboard() {

    const today =
        new Date()
            .toISOString()
            .split("T")[0];


    const todaySales =
        systemData.sales
            .filter(
                sale =>
                    getRecordDate(sale)
                    === today
            )
            .reduce(
                (
                    total,
                    sale
                ) =>
                    total +
                    toNumber(
                        sale.total
                    ),
                0
            );


    const todayPurchases =
        systemData.purchases
            .filter(
                purchase =>
                    getRecordDate(purchase)
                    === today
            )
            .reduce(
                (
                    total,
                    purchase
                ) =>
                    total +
                    toNumber(
                        purchase.grandTotal ??
                        purchase.total
                    ),
                0
            );


    const inventoryCost =
        calculateInventoryCost();


    const netProfit =
        calculateNetProfit();


    setText(
        "dashboardTodaySales",
        formatMoney(todaySales)
    );


    setText(
        "dashboardTodayPurchases",
        formatMoney(todayPurchases)
    );


    setText(
        "dashboardInventoryCost",
        formatMoney(inventoryCost)
    );


    setText(
        "dashboardNetProfit",
        formatMoney(netProfit)
    );


    renderDashboardRecentSales();

    renderDashboardStockAlerts();

}


// =========================================================
// آخر المبيعات
// =========================================================

function renderDashboardRecentSales() {

    const container =
        document.getElementById(
            "dashboardRecentSales"
        );


    if (!container) return;


    const sales =
        [...systemData.sales]
            .sort(
                (
                    a,
                    b
                ) =>
                    getRecordDate(b)
                    .localeCompare(
                        getRecordDate(a)
                    )
            )
            .slice(
                0,
                5
            );


    if (!sales.length) {

        container.innerHTML =
            `<div class="empty-state">
                لا توجد مبيعات حتى الآن
            </div>`;

        return;

    }


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>الفاتورة</th>

                    <th>العميل</th>

                    <th>التاريخ</th>

                    <th>الإجمالي</th>

                </tr>

            </thead>

            <tbody>

                ${sales.map(
                    sale => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                sale.invoiceNumber ||
                                sale.id ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                sale.customerName ||
                                "نقدي"
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                getRecordDate(sale)
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                sale.total
                            )}
                        </td>

                    </tr>

                `
                ).join("")}

            </tbody>

        </table>

    `;

}


// =========================================================
// تنبيهات المخزون
// =========================================================

function renderDashboardStockAlerts() {

    const container =
        document.getElementById(
            "dashboardStockAlerts"
        );


    if (!container) return;


    const alerts =
        systemData.products
            .filter(
                product =>
                    toNumber(
                        product.quantity
                    )
                    <=
                    toNumber(
                        product.minStock
                    )
            )
            .slice(
                0,
                8
            );


    if (!alerts.length) {

        container.innerHTML =
            `<div class="empty-state">
                لا توجد تنبيهات مخزون
            </div>`;

        return;

    }


    container.innerHTML =
        alerts.map(
            product => `

            <div class="alert-item">

                <strong>
                    ${escapeHtml(
                        product.name ||
                        "-"
                    )}
                </strong>

                <br>

                الكمية الحالية:
                ${formatNumber(
                    product.quantity
                )}

            </div>

        `
        ).join("");

}


// =========================================================
// المبيعات
// =========================================================

function renderSales(
    sales = systemData.sales
) {

    const container =
        document.getElementById(
            "salesTable"
        );


    if (!container) return;


    if (!sales.length) {

        container.innerHTML =
            `<div class="empty-state">
                لا توجد فواتير مبيعات
            </div>`;

        return;

    }


    const sorted =
        [...sales]
            .sort(
                (
                    a,
                    b
                ) =>
                    getRecordDate(b)
                    .localeCompare(
                        getRecordDate(a)
                    )
            );


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>رقم الفاتورة</th>

                    <th>التاريخ</th>

                    <th>العميل</th>

                    <th>الإجمالي</th>

                    <th>المدفوع</th>

                    <th>المتبقي</th>

                    <th>الإجراءات</th>

                </tr>

            </thead>

            <tbody>

                ${sorted.map(
                    sale => {

                        const total =
                            toNumber(
                                sale.total
                            );

                        const paid =
                            toNumber(
                                sale.paid
                            );

                        const remaining =
                            total - paid;


                        return `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    sale.invoiceNumber ||
                                    sale.id
                                )}
                            </td>

                            <td>
                                ${formatDate(
                                    getRecordDate(sale)
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    sale.customerName ||
                                    "نقدي"
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    total
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    paid
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    remaining
                                )}
                            </td>

                            <td>

                                <div class="table-actions">

                                    <button
                                        onclick="viewSale('${sale.id}')">
                                        عرض
                                    </button>

                                    <button
                                        onclick="deleteSale('${sale.id}')">
                                        حذف
                                    </button>

                                </div>

                            </td>

                        </tr>

                        `;

                    }
                ).join("")}

            </tbody>

        </table>

    `;

}


// =========================================================
// البحث في المبيعات
// =========================================================

function searchSales(
    text
) {

    const value =
        normalizeSearchText(
            text
        );


    if (!value) {

        renderSales();

        return;

    }


    const results =
        systemData.sales.filter(
            sale => {

                return matchesSearch(
                    [
                        sale.invoiceNumber,
                        sale.customerName,
                        sale.customerPhone,
                        sale.notes
                    ],
                    value
                );

            }
        );


    renderSales(
        results
    );

}


// =========================================================
// فلترة المبيعات بالتاريخ
// =========================================================

function filterSales() {

    const from =
        document.getElementById(
            "salesDateFrom"
        )?.value || "";


    const to =
        document.getElementById(
            "salesDateTo"
        )?.value || "";


    const search =
        document.getElementById(
            "salesSearch"
        )?.value || "";


    let results =
        [...systemData.sales];


    if (from) {

        results =
            results.filter(
                sale =>
                    getRecordDate(sale)
                    >=
                    from
            );

    }


    if (to) {

        results =
            results.filter(
                sale =>
                    getRecordDate(sale)
                    <=
                    to
            );

    }


    if (search.trim()) {

        const value =
            normalizeSearchText(
                search
            );


        results =
            results.filter(
                sale =>
                    matchesSearch(
                        [
                            sale.invoiceNumber,
                            sale.customerName,
                            sale.customerPhone,
                            sale.notes
                        ],
                        value
                    )
            );

    }


    renderSales(
        results
    );

}


// =========================================================
// المشتريات
// =========================================================

function renderPurchases(
    purchases = systemData.purchases
) {

    const container =
        document.getElementById(
            "purchasesTable"
        );


    if (!container) return;


    if (!purchases.length) {

        container.innerHTML =
            `<div class="empty-state">
                لا توجد فواتير مشتريات
            </div>`;

        return;

    }


    const sorted =
        [...purchases]
            .sort(
                (
                    a,
                    b
                ) =>
                    getRecordDate(b)
                    .localeCompare(
                        getRecordDate(a)
                    )
            );


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>رقم الفاتورة</th>

                    <th>التاريخ</th>

                    <th>المورد</th>

                    <th>العملة</th>

                    <th>قيمة الأصناف</th>

                    <th>المصروفات الإضافية</th>

                    <th>التكلفة الفعلية</th>

                    <th>الإجراءات</th>

                </tr>

            </thead>

            <tbody>

                ${sorted.map(
                    purchase => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                purchase.invoiceNumber ||
                                purchase.id
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                getRecordDate(
                                    purchase
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                purchase.supplierName ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                purchase.currency ||
                                "EGP"
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                purchase.total
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                purchase.extraExpenses
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                purchase.grandTotal
                                ??
                                purchase.total
                            )}
                        </td>

                        <td>

                            <div class="table-actions">

                                <button
                                    onclick="viewPurchase('${purchase.id}')">
                                    عرض
                                </button>

                                <button
                                    onclick="deletePurchase('${purchase.id}')">
                                    حذف
                                </button>

                            </div>

                        </td>

                    </tr>

                `
                ).join("")}

            </tbody>

        </table>

    `;

}


// =========================================================
// بحث المشتريات
// =========================================================

function searchPurchases(
    text
) {

    const value =
        normalizeSearchText(
            text
        );


    if (!value) {

        renderPurchases();

        return;

    }


    const results =
        systemData.purchases.filter(
            purchase =>
                matchesSearch(
                    [
                        purchase.invoiceNumber,
                        purchase.supplierName,
                        purchase.notes
                    ],
                    value
                )
        );


    renderPurchases(
        results
    );

}


// =========================================================
// المصروفات
// =========================================================

function renderExpenses(
    expenses = systemData.expenses
) {

    const container =
        document.getElementById(
            "expensesTable"
        );


    if (!container) return;


    if (!expenses.length) {

        container.innerHTML =
            `<div class="empty-state">
                لا توجد مصروفات
            </div>`;

        return;

    }


    const sorted =
        [...expenses]
            .sort(
                (
                    a,
                    b
                ) =>
                    getRecordDate(b)
                    .localeCompare(
                        getRecordDate(a)
                    )
            );


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>التاريخ</th>

                    <th>النوع</th>

                    <th>البيان</th>

                    <th>المبلغ</th>

                    <th>الإجراءات</th>

                </tr>

            </thead>

            <tbody>

                ${sorted.map(
                    expense => `

                    <tr>

                        <td>
                            ${formatDate(
                                getRecordDate(
                                    expense
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                expense.category ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                expense.description ||
                                expense.notes ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                expense.amount
                            )}
                        </td>

                        <td>

                            <div class="table-actions">

                                <button
                                    onclick="editExpense('${expense.id}')">
                                    تعديل
                                </button>

                                <button
                                    onclick="deleteExpense('${expense.id}')">
                                    حذف
                                </button>

                            </div>

                        </td>

                    </tr>

                `
                ).join("")}

            </tbody>

        </table>

    `;

}


// =========================================================
// المخزون
// =========================================================

function renderInventory(
    products = systemData.products
) {

    updateInventoryStats();

    updateInventoryCategories();


    const container =
        document.getElementById(
            "inventoryTable"
        );


    if (!container) return;


    if (!products.length) {

        container.innerHTML =
            `<div class="empty-state">
                لا توجد أصناف
            </div>`;

        return;

    }


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>الكود</th>

                    <th>الباركود</th>

                    <th>الصنف</th>

                    <th>القسم</th>

                    <th>الكمية</th>

                    <th>متوسط التكلفة</th>

                    <th>سعر البيع</th>

                    <th>قيمة التكلفة</th>

                    <th>قيمة البيع</th>

                    <th>الإجراءات</th>

                </tr>

            </thead>

            <tbody>

                ${products.map(
                    product => {

                        const quantity =
                            toNumber(
                                product.quantity
                            );

                        const cost =
                            toNumber(
                                product.buyPrice ??
                                product.averageCost
                            );

                        const salePrice =
                            toNumber(
                                product.sellPrice
                            );


                        const costValue =
                            quantity *
                            cost;


                        const saleValue =
                            quantity *
                            salePrice;


                        const lowStock =
                            quantity <=
                            toNumber(
                                product.minStock
                            );


                        return `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    product.code ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    product.barcode ||
                                    "-"
                                )}
                            </td>

                            <td>
                                <strong>
                                    ${escapeHtml(
                                        product.name ||
                                        "-"
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${escapeHtml(
                                    product.category ||
                                    "-"
                                )}
                            </td>

                            <td>

                                <span class="
                                    badge
                                    ${
                                        lowStock
                                        ?
                                        "badge-warning"
                                        :
                                        "badge-success"
                                    }
                                ">

                                    ${formatNumber(
                                        quantity
                                    )}

                                </span>

                            </td>

                            <td>
                                ${formatMoney(
                                    cost
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    salePrice
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    costValue
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    saleValue
                                )}
                            </td>

                            <td>

                                <div class="table-actions">

                                    <button
                                        onclick="editProduct('${product.id}')">
                                        تعديل
                                    </button>

                                    <button
                                        onclick="deleteProduct('${product.id}')">
                                        حذف
                                    </button>

                                </div>

                            </td>

                        </tr>

                        `;

                    }
                ).join("")}

            </tbody>

        </table>

    `;

}


// =========================================================
// إحصائيات المخزون
// =========================================================

function updateInventoryStats() {

    const products =
        systemData.products;


    const count =
        products.length;


    let costValue = 0;

    let saleValue = 0;


    products.forEach(
        product => {

            const quantity =
                toNumber(
                    product.quantity
                );


            const cost =
                toNumber(
                    product.buyPrice ??
                    product.averageCost
                );


            const sale =
                toNumber(
                    product.sellPrice
                );


            costValue +=
                quantity * cost;


            saleValue +=
                quantity * sale;

        }
    );


    const deadStock =
        calculateDeadStockValue(
            90
        );


    setText(
        "inventoryProductsCount",
        formatNumber(count)
    );


    setText(
        "inventoryCostValue",
        formatMoney(costValue)
    );


    setText(
        "inventorySaleValue",
        formatMoney(saleValue)
    );


    setText(
        "inventoryDeadStockValue",
        formatMoney(
            deadStock.costValue
        )
    );

}


// =========================================================
// أقسام المخزون
// =========================================================

function updateInventoryCategories() {

    const select =
        document.getElementById(
            "inventoryCategoryFilter"
        );


    if (!select) return;


    const current =
        select.value;


    const categories =
        [
            ...new Set(
                systemData.products
                    .map(
                        product =>
                            product.category
                    )
                    .filter(Boolean)
            )
        ]
        .sort();


    select.innerHTML = `

        <option value="">
            كل الأقسام
        </option>

        ${categories.map(
            category => `

            <option value="${escapeAttribute(
                category
            )}">

                ${escapeHtml(
                    category
                )}

            </option>

        `
        ).join("")}

    `;


    if (
        categories.includes(
            current
        )
    ) {

        select.value =
            current;

    }

}


// =========================================================
// بحث المخزون
// =========================================================

function searchInventory(
    text
) {

    const value =
        normalizeSearchText(
            text
        );


    if (!value) {

        filterInventory();

        return;

    }


    const category =
        document.getElementById(
            "inventoryCategoryFilter"
        )?.value || "";


    let products =
        systemData.products.filter(
            product =>
                matchesSearch(
                    [
                        product.name,
                        product.code,
                        product.barcode,
                        product.category,
                        product.notes
                    ],
                    value
                )
        );


    if (category) {

        products =
            products.filter(
                product =>
                    product.category
                    ===
                    category
            );

    }


    renderInventory(
        products
    );

}


// =========================================================
// فلترة المخزون
// =========================================================

function filterInventory() {

    const search =
        document.getElementById(
            "inventorySearch"
        )?.value || "";


    const category =
        document.getElementById(
            "inventoryCategoryFilter"
        )?.value || "";


    let products =
        [...systemData.products];


    if (search.trim()) {

        const value =
            normalizeSearchText(
                search
            );


        products =
            products.filter(
                product =>
                    matchesSearch(
                        [
                            product.name,
                            product.code,
                            product.barcode,
                            product.category,
                            product.notes
                        ],
                        value
                    )
            );

    }


    if (category) {

        products =
            products.filter(
                product =>
                    product.category
                    ===
                    category
            );

    }


    renderInventory(
        products
    );

}


// =========================================================
// الرواكد
// =========================================================

function calculateDeadStockValue(
    days = 90
) {

    const limit =
        new Date();


    limit.setDate(
        limit.getDate() -
        Number(days)
    );


    const limitDate =
        limit
            .toISOString()
            .split("T")[0];


    let costValue = 0;

    let saleValue = 0;

    let products = [];


    systemData.products.forEach(
        product => {

            const quantity =
                toNumber(
                    product.quantity
                );


            if (quantity <= 0) return;


            const lastMovement =
                getProductLastMovementDate(
                    product
                );


            if (
                lastMovement &&
                lastMovement > limitDate
            ) {

                return;

            }


            const cost =
                toNumber(
                    product.buyPrice ??
                    product.averageCost
                );


            const sale =
                toNumber(
                    product.sellPrice
                );


            const itemCost =
                quantity *
                cost;


            const itemSale =
                quantity *
                sale;


            costValue +=
                itemCost;


            saleValue +=
                itemSale;


            products.push({

                product,

                quantity,

                costValue:
                    itemCost,

                saleValue:
                    itemSale,

                lastMovement

            });

        }
    );


    return {

        products,

        costValue,

        saleValue

    };

}


// =========================================================
// تاريخ آخر حركة للصنف
// =========================================================

function getProductLastMovementDate(
    product
) {

    const dates = [];


    if (product.updatedAt) {

        dates.push(
            normalizeFirestoreDate(
                product.updatedAt
            )
        );

    }


    systemData.sales.forEach(
        sale => {

            const items =
                Array.isArray(
                    sale.items
                )
                ?
                sale.items
                :
                [];


            if (
                items.some(
                    item =>
                        item.productId
                        ===
                        product.id
                )
            ) {

                dates.push(
                    getRecordDate(
                        sale
                    )
                );

            }

        }
    );


    systemData.purchases.forEach(
        purchase => {

            const items =
                Array.isArray(
                    purchase.items
                )
                ?
                purchase.items
                :
                [];


            if (
                items.some(
                    item =>
                        item.productId
                        ===
                        product.id
                )
            ) {

                dates.push(
                    getRecordDate(
                        purchase
                    )
                );

            }

        }
    );


    if (!dates.length) {

        return "";

    }


    return dates.sort().pop();

}


// =========================================================
// عرض الرواكد
// =========================================================

function calculateDeadStock() {

    const days =
        toNumber(
            document.getElementById(
                "deadStockDays"
            )?.value
        ) || 90;


    const result =
        calculateDeadStockValue(
            days
        );


    const container =
        document.getElementById(
            "deadStockTable"
        );


    if (!container) return;


    if (!result.products.length) {

        container.innerHTML =
            `<div class="empty-state">
                لا توجد أصناف راكدة حسب الفترة المحددة
            </div>`;

        return;

    }


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>الصنف</th>

                    <th>الكمية</th>

                    <th>التكلفة</th>

                    <th>قيمة التكلفة</th>

                    <th>قيمة البيع</th>

                    <th>آخر حركة</th>

                </tr>

            </thead>

            <tbody>

                ${result.products.map(
                    item => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                item.product.name
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                item.quantity
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                item.product.buyPrice ??
                                item.product.averageCost
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                item.costValue
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                item.saleValue
                            )}
                        </td>

                        <td>
                            ${
                                item.lastMovement
                                ?
                                formatDate(
                                    item.lastMovement
                                )
                                :
                                "لا توجد حركة"
                            }
                        </td>

                    </tr>

                `
                ).join("")}

            </tbody>

        </table>

        <div class="invoice-summary">

            <div class="summary-box">

                <span>
                    قيمة الرواكد بالتكلفة
                </span>

                <strong>
                    ${formatMoney(
                        result.costValue
                    )}
                </strong>

            </div>


            <div class="summary-box">

                <span>
                    قيمة الرواكد بسعر البيع
                </span>

                <strong>
                    ${formatMoney(
                        result.saleValue
                    )}
                </strong>

            </div>

        </div>

    `;

}


// =========================================================
// العملاء
// =========================================================

function renderCustomers(
    customers = systemData.customers
) {

    const container =
        document.getElementById(
            "customersTable"
        );


    if (!container) return;


    if (!customers.length) {

        container.innerHTML =
            `<div class="empty-state">
                لا يوجد عملاء
            </div>`;

        return;

    }


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>الاسم</th>

                    <th>الهاتف</th>

                    <th>العنوان</th>

                    <th>الرصيد</th>

                    <th>الإجراءات</th>

                </tr>

            </thead>

            <tbody>

                ${customers.map(
                    customer => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                customer.name ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                customer.phone ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                customer.address ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                customer.balance
                            )}
                        </td>

                        <td>

                            <div class="table-actions">

                                <button
                                    onclick="editCustomer('${customer.id}')">
                                    تعديل
                                </button>

                                <button
                                    onclick="deleteCustomer('${customer.id}')">
                                    حذف
                                </button>

                            </div>

                        </td>

                    </tr>

                `
                ).join("")}

            </tbody>

        </table>

    `;

}


// =========================================================
// بحث العملاء
// =========================================================

function searchCustomers(
    text
) {

    const value =
        normalizeSearchText(
            text
        );


    if (!value) {

        renderCustomers();

        return;

    }


    const results =
        systemData.customers.filter(
            customer =>
                matchesSearch(
                    [
                        customer.name,
                        customer.phone,
                        customer.address,
                        customer.notes
                    ],
                    value
                )
        );


    renderCustomers(
        results
    );

}


// =========================================================
// الموردون
// =========================================================

function renderSuppliers(
    suppliers = systemData.suppliers
) {

    const container =
        document.getElementById(
            "suppliersTable"
        );


    if (!container) return;


    if (!suppliers.length) {

        container.innerHTML =
            `<div class="empty-state">
                لا يوجد موردون
            </div>`;

        return;

    }


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>الاسم</th>

                    <th>الهاتف</th>

                    <th>العنوان</th>

                    <th>الرصيد</th>

                    <th>الإجراءات</th>

                </tr>

            </thead>

            <tbody>

                ${suppliers.map(
                    supplier => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                supplier.name ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                supplier.phone ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                supplier.address ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                supplier.balance
                            )}
                        </td>

                        <td>

                            <div class="table-actions">

                                <button
                                    onclick="editSupplier('${supplier.id}')">
                                    تعديل
                                </button>

                                <button
                                    onclick="deleteSupplier('${supplier.id}')">
                                    حذف
                                </button>

                            </div>

                        </td>

                    </tr>

                `
                ).join("")}

            </tbody>

        </table>

    `;

}


// =========================================================
// بحث الموردين
// =========================================================

function searchSuppliers(
    text
) {

    const value =
        normalizeSearchText(
            text
        );


    if (!value) {

        renderSuppliers();

        return;

    }


    const results =
        systemData.suppliers.filter(
            supplier =>
                matchesSearch(
                    [
                        supplier.name,
                        supplier.phone,
                        supplier.address,
                        supplier.notes
                    ],
                    value
                )
        );


    renderSuppliers(
        results
    );

}


// =========================================================
// العمال
// =========================================================

function renderEmployees(
    employees = systemData.employees
) {

    const container =
        document.getElementById(
            "employeesTable"
        );


    if (!container) return;


    const count =
        systemData.employees.length;


    const salaries =
        systemData.employees
            .reduce(
                (
                    total,
                    employee
                ) =>
                    total +
                    toNumber(
                        employee.salary
                    ),
                0
            );


    setText(
        "employeesCount",
        formatNumber(count)
    );


    setText(
        "monthlySalaries",
        formatMoney(salaries)
    );


    if (!employees.length) {

        container.innerHTML =
            `<div class="empty-state">
                لا يوجد عمال
            </div>`;

        return;

    }


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>الاسم</th>

                    <th>الهاتف</th>

                    <th>الرقم القومي</th>

                    <th>الوظيفة</th>

                    <th>نوع الأجر</th>

                    <th>الأجر</th>

                    <th>الإجراءات</th>

                </tr>

            </thead>

            <tbody>

                ${employees.map(
                    employee => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                employee.name ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                employee.phone ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                employee.nationalId ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                employee.job ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                employee.salaryType ||
                                "شهري"
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                employee.salary
                            )}
                        </td>

                        <td>

                            <div class="table-actions">

                                <button
                                    onclick="editEmployee('${employee.id}')">
                                    تعديل
                                </button>

                                <button
                                    onclick="deleteEmployee('${employee.id}')">
                                    حذف
                                </button>

                            </div>

                        </td>

                    </tr>

                `
                ).join("")}

            </tbody>

        </table>

    `;

}


// =========================================================
// بحث العمال
// =========================================================

function searchEmployees(
    text
) {

    const value =
        normalizeSearchText(
            text
        );


    if (!value) {

        renderEmployees();

        return;

    }


    const results =
        systemData.employees.filter(
            employee =>
                matchesSearch(
                    [
                        employee.name,
                        employee.phone,
                        employee.nationalId,
                        employee.job
                    ],
                    value
                )
        );


    renderEmployees(
        results
    );

}


// =========================================================
// المستثمرون
// =========================================================

function renderInvestors(
    investors = systemData.investors
) {

    const container =
        document.getElementById(
            "investorsTable"
        );


    if (!container) return;


    if (!investors.length) {

        container.innerHTML =
            `<div class="empty-state">
                لا يوجد مستثمرون
            </div>`;

        return;

    }


    const totalCapital =
        investors.reduce(
            (
                total,
                investor
            ) =>
                total +
                toNumber(
                    investor.capital
                ),
            0
        );


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>المستثمر</th>

                    <th>الهاتف</th>

                    <th>رأس المال</th>

                    <th>النسبة</th>

                    <th>الإجراءات</th>

                </tr>

            </thead>

            <tbody>

                ${investors.map(
                    investor => {

                        const capital =
                            toNumber(
                                investor.capital
                            );


                        const percentage =
                            totalCapital > 0
                            ?
                            (
                                capital /
                                totalCapital *
                                100
                            )
                            :
                            0;


                        return `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    investor.name ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    investor.phone ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    capital
                                )}
                            </td>

                            <td>
                                ${percentage.toFixed(
                                    2
                                )}%
                            </td>

                            <td>

                                <div class="table-actions">

                                    <button
                                        onclick="editInvestor('${investor.id}')">
                                        تعديل
                                    </button>

                                    <button
                                        onclick="deleteInvestor('${investor.id}')">
                                        حذف
                                    </button>

                                </div>

                            </td>

                        </tr>

                        `;

                    }
                ).join("")}

            </tbody>

        </table>

    `;

}


// =========================================================
// توزيع الأرباح
// =========================================================

function calculateProfitDistribution() {

    const profit =
        toNumber(
            document.getElementById(
                "profitToDistribute"
            )?.value
        );


    const container =
        document.getElementById(
            "profitDistributionTable"
        );


    if (!container) return;


    if (
        profit <= 0
    ) {

        showToast(
            "أدخل قيمة ربح صحيحة",
            "warning"
        );

        return;

    }


    if (
        !systemData.investors.length
    ) {

        container.innerHTML =
            `<div class="empty-state">
                لا يوجد مستثمرون
            </div>`;

        return;

    }


    const totalCapital =
        systemData.investors
            .reduce(
                (
                    total,
                    investor
                ) =>
                    total +
                    toNumber(
                        investor.capital
                    ),
                0
            );


    if (totalCapital <= 0) {

        showToast(
            "إجمالي رأس المال يساوي صفر",
            "warning"
        );

        return;

    }


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>المستثمر</th>

                    <th>رأس المال</th>

                    <th>النسبة</th>

                    <th>نصيبه من الربح</th>

                </tr>

            </thead>

            <tbody>

                ${systemData.investors.map(
                    investor => {

                        const capital =
                            toNumber(
                                investor.capital
                            );


                        const percentage =
                            capital /
                            totalCapital;


                        const share =
                            profit *
                            percentage;


                        return `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    investor.name
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    capital
                                )}
                            </td>

                            <td>
                                ${(
                                    percentage *
                                    100
                                ).toFixed(2)}%
                            </td>

                            <td>
                                <strong>
                                    ${formatMoney(
                                        share
                                    )}
                                </strong>
                            </td>

                        </tr>

                        `;

                    }
                ).join("")}

            </tbody>

        </table>

    `;

}


// =========================================================
// الإعدادات
// =========================================================

function renderSettings() {

    const settings =
        systemData.settings || {};


    setInputValue(
        "businessName",
        settings.businessName
    );


    setInputValue(
        "businessPhone",
        settings.businessPhone
    );


    setInputValue(
        "baseCurrency",
        settings.baseCurrency ||
        "EGP"
    );

}


// =========================================================
// حساب قيمة المخزون
// =========================================================

function calculateInventoryCost() {

    return systemData.products
        .reduce(
            (
                total,
                product
            ) => {

                const quantity =
                    toNumber(
                        product.quantity
                    );


                const cost =
                    toNumber(
                        product.buyPrice ??
                        product.averageCost
                    );


                return total +
                    (
                        quantity *
                        cost
                    );

            },
            0
        );

}


// =========================================================
// حساب صافي الربح
// =========================================================

function calculateNetProfit() {

    const sales =
        systemData.sales
            .reduce(
                (
                    total,
                    sale
                ) =>
                    total +
                    toNumber(
                        sale.total
                    ),
                0
            );


    const costOfSales =
        systemData.sales
            .reduce(
                (
                    total,
                    sale
                ) => {

                    const items =
                        Array.isArray(
                            sale.items
                        )
                        ?
                        sale.items
                        :
                        [];


                    const cost =
                        items.reduce(
                            (
                                sum,
                                item
                            ) =>
                                sum +
                                (
                                    toNumber(
                                        item.quantity
                                    ) *
                                    toNumber(
                                        item.cost ??
                                        item.buyPrice
                                    )
                                ),
                            0
                        );


                    return total +
                        cost;

                },
                0
            );


    const expenses =
        systemData.expenses
            .reduce(
                (
                    total,
                    expense
                ) =>
                    total +
                    toNumber(
                        expense.amount
                    ),
                0
            );


    return sales -
        costOfSales -
        expenses;

}


// =========================================================
// إضافة منتج
// =========================================================

function newProduct() {

    openModal(
        "إضافة صنف جديد",
        `
        <form id="productForm">

            <div class="form-grid">

                <div class="form-group">

                    <label>اسم الصنف *</label>

                    <input
                        id="productName"
                        class="form-control"
                        required>

                </div>


                <div class="form-group">

                    <label>الكود</label>

                    <input
                        id="productCode"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>الباركود</label>

                    <input
                        id="productBarcode"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>القسم</label>

                    <input
                        id="productCategory"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>الوحدة</label>

                    <input
                        id="productUnit"
                        class="form-control"
                        value="قطعة">

                </div>


                <div class="form-group">

                    <label>الكمية الافتتاحية</label>

                    <input
                        id="productQuantity"
                        type="number"
                        min="0"
                        step="0.01"
                        value="0"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>الحد الأدنى للمخزون</label>

                    <input
                        id="productMinStock"
                        type="number"
                        min="0"
                        step="0.01"
                        value="0"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>تكلفة الشراء</label>

                    <input
                        id="productBuyPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value="0"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>سعر البيع</label>

                    <input
                        id="productSellPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value="0"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>ملاحظات</label>

                    <textarea
                        id="productNotes"
                        class="form-control"></textarea>

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ الصنف",
                className: "btn btn-primary",
                action: saveNewProduct
            }
        ]
    );

}


// =========================================================
// حفظ منتج جديد
// =========================================================

async function saveNewProduct() {

    const name =
        getValue(
            "productName"
        );


    if (!name) {

        showToast(
            "اسم الصنف مطلوب",
            "warning"
        );

        return;

    }


    const product = {

        name,

        code:
            getValue(
                "productCode"
            ),

        barcode:
            getValue(
                "productBarcode"
            ),

        category:
            getValue(
                "productCategory"
            ),

        unit:
            getValue(
                "productUnit"
            ) || "قطعة",

        quantity:
            toNumber(
                getValue(
                    "productQuantity"
                )
            ),

        minStock:
            toNumber(
                getValue(
                    "productMinStock"
                )
            ),

        buyPrice:
            toNumber(
                getValue(
                    "productBuyPrice"
                )
            ),

        sellPrice:
            toNumber(
                getValue(
                    "productSellPrice"
                )
            ),

        notes:
            getValue(
                "productNotes"
            ),

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    try {

        const reference =
            await addDoc(
                collection(
                    db,
                    COLLECTIONS.products
                ),
                product
            );


        systemData.products.push({

            id:
                reference.id,

            ...product,

            createdAt:
                new Date()
                    .toISOString(),

            updatedAt:
                new Date()
                    .toISOString()

        });


        closeModal();

        refreshCurrentPage();

        showToast(
            "تم إضافة الصنف بنجاح",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حفظ الصنف",
            "error"
        );

    }

}


// =========================================================
// تعديل منتج
// =========================================================

function editProduct(
    id
) {

    const product =
        systemData.products.find(
            item =>
                item.id === id
        );


    if (!product) return;


    openModal(
        "تعديل الصنف",
        `
        <form id="editProductForm">

            <div class="form-grid">

                <div class="form-group">

                    <label>اسم الصنف *</label>

                    <input
                        id="editProductName"
                        class="form-control"
                        value="${escapeAttribute(
                            product.name
                        )}"
                        required>

                </div>


                <div class="form-group">

                    <label>الكود</label>

                    <input
                        id="editProductCode"
                        class="form-control"
                        value="${escapeAttribute(
                            product.code
                        )}">

                </div>


                <div class="form-group">

                    <label>الباركود</label>

                    <input
                        id="editProductBarcode"
                        class="form-control"
                        value="${escapeAttribute(
                            product.barcode
                        )}">

                </div>


                <div class="form-group">

                    <label>القسم</label>

                    <input
                        id="editProductCategory"
                        class="form-control"
                        value="${escapeAttribute(
                            product.category
                        )}">

                </div>


                <div class="form-group">

                    <label>الوحدة</label>

                    <input
                        id="editProductUnit"
                        class="form-control"
                        value="${escapeAttribute(
                            product.unit ||
                            "قطعة"
                        )}">

                </div>


                <div class="form-group">

                    <label>الكمية</label>

                    <input
                        id="editProductQuantity"
                        type="number"
                        min="0"
                        step="0.01"
                        class="form-control"
                        value="${toNumber(
                            product.quantity
                        )}">

                </div>


                <div class="form-group">

                    <label>الحد الأدنى</label>

                    <input
                        id="editProductMinStock"
                        type="number"
                        min="0"
                        step="0.01"
                        class="form-control"
                        value="${toNumber(
                            product.minStock
                        )}">

                </div>


                <div class="form-group">

                    <label>متوسط التكلفة</label>

                    <input
                        id="editProductBuyPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        class="form-control"
                        value="${toNumber(
                            product.buyPrice ??
                            product.averageCost
                        )}">

                </div>


                <div class="form-group">

                    <label>سعر البيع</label>

                    <input
                        id="editProductSellPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        class="form-control"
                        value="${toNumber(
                            product.sellPrice
                        )}">

                </div>


                <div class="form-group">

                    <label>ملاحظات</label>

                    <textarea
                        id="editProductNotes"
                        class="form-control">${escapeHtml(
                            product.notes || ""
                        )}</textarea>

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ التعديل",
                className: "btn btn-primary",
                action: () =>
                    updateProduct(
                        id
                    )
            }
        ]
    );

}


// =========================================================
// تحديث المنتج
// =========================================================

async function updateProduct(
    id
) {

    const name =
        getValue(
            "editProductName"
        );


    if (!name) {

        showToast(
            "اسم الصنف مطلوب",
            "warning"
        );

        return;

    }


    const updates = {

        name,

        code:
            getValue(
                "editProductCode"
            ),

        barcode:
            getValue(
                "editProductBarcode"
            ),

        category:
            getValue(
                "editProductCategory"
            ),

        unit:
            getValue(
                "editProductUnit"
            ),

        quantity:
            toNumber(
                getValue(
                    "editProductQuantity"
                )
            ),

        minStock:
            toNumber(
                getValue(
                    "editProductMinStock"
                )
            ),

        buyPrice:
            toNumber(
                getValue(
                    "editProductBuyPrice"
                )
            ),

        sellPrice:
            toNumber(
                getValue(
                    "editProductSellPrice"
                )
            ),

        notes:
            getValue(
                "editProductNotes"
            ),

        updatedAt:
            serverTimestamp()

    };


    try {

        await updateDoc(
            doc(
                db,
                COLLECTIONS.products,
                id
            ),
            updates
        );


        const index =
            systemData.products.findIndex(
                item =>
                    item.id === id
            );


        if (index !== -1) {

            systemData.products[index] = {

                ...systemData.products[index],

                ...updates,

                updatedAt:
                    new Date()
                        .toISOString()

            };

        }


        closeModal();

        refreshCurrentPage();

        showToast(
            "تم تعديل الصنف",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر تعديل الصنف",
            "error"
        );

    }

}


// =========================================================
// حذف منتج
// =========================================================

async function deleteProduct(
    id
) {

    if (
        !confirm(
            "هل أنت متأكد من حذف هذا الصنف؟"
        )
    ) {

        return;

    }


    try {

        await deleteDoc(
            doc(
                db,
                COLLECTIONS.products,
                id
            )
        );


        systemData.products =
            systemData.products.filter(
                product =>
                    product.id !== id
            );


        refreshCurrentPage();

        showToast(
            "تم حذف الصنف",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حذف الصنف",
            "error"
        );

    }

}


// =========================================================
// العملاء - إضافة
// =========================================================

function newCustomer() {

    openModal(
        "إضافة عميل",
        `
        <form>

            <div class="form-grid">

                <div class="form-group">

                    <label>اسم العميل *</label>

                    <input
                        id="customerName"
                        class="form-control"
                        required>

                </div>


                <div class="form-group">

                    <label>الهاتف</label>

                    <input
                        id="customerPhone"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>العنوان</label>

                    <input
                        id="customerAddress"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>الرصيد الافتتاحي</label>

                    <input
                        id="customerBalance"
                        type="number"
                        step="0.01"
                        class="form-control"
                        value="0">

                </div>


                <div class="form-group">

                    <label>ملاحظات</label>

                    <textarea
                        id="customerNotes"
                        class="form-control"></textarea>

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ",
                className: "btn btn-primary",
                action: saveNewCustomer
            }
        ]
    );

}


// =========================================================
// حفظ عميل
// =========================================================

async function saveNewCustomer() {

    const name =
        getValue(
            "customerName"
        );


    if (!name) {

        showToast(
            "اسم العميل مطلوب",
            "warning"
        );

        return;

    }


    const customer = {

        name,

        phone:
            getValue(
                "customerPhone"
            ),

        address:
            getValue(
                "customerAddress"
            ),

        balance:
            toNumber(
                getValue(
                    "customerBalance"
                )
            ),

        notes:
            getValue(
                "customerNotes"
            ),

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    try {

        const reference =
            await addDoc(
                collection(
                    db,
                    COLLECTIONS.customers
                ),
                customer
            );


        systemData.customers.push({

            id:
                reference.id,

            ...customer,

            createdAt:
                new Date()
                    .toISOString(),

            updatedAt:
                new Date()
                    .toISOString()

        });


        closeModal();

        refreshCurrentPage();

        showToast(
            "تم إضافة العميل",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حفظ العميل",
            "error"
        );

    }

}


// =========================================================
// تعديل عميل
// =========================================================

function editCustomer(
    id
) {

    const customer =
        systemData.customers.find(
            item =>
                item.id === id
        );


    if (!customer) return;


    openModal(
        "تعديل العميل",
        `
        <form>

            <div class="form-grid">

                <div class="form-group">

                    <label>اسم العميل *</label>

                    <input
                        id="editCustomerName"
                        class="form-control"
                        value="${escapeAttribute(
                            customer.name
                        )}">

                </div>


                <div class="form-group">

                    <label>الهاتف</label>

                    <input
                        id="editCustomerPhone"
                        class="form-control"
                        value="${escapeAttribute(
                            customer.phone
                        )}">

                </div>


                <div class="form-group">

                    <label>العنوان</label>

                    <input
                        id="editCustomerAddress"
                        class="form-control"
                        value="${escapeAttribute(
                            customer.address
                        )}">

                </div>


                <div class="form-group">

                    <label>الرصيد</label>

                    <input
                        id="editCustomerBalance"
                        type="number"
                        step="0.01"
                        class="form-control"
                        value="${toNumber(
                            customer.balance
                        )}">

                </div>


                <div class="form-group">

                    <label>ملاحظات</label>

                    <textarea
                        id="editCustomerNotes"
                        class="form-control">${escapeHtml(
                            customer.notes || ""
                        )}</textarea>

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ",
                className: "btn btn-primary",
                action: () =>
                    updateCustomer(
                        id
                    )
            }
        ]
    );

}


// =========================================================
// تحديث عميل
// =========================================================

async function updateCustomer(
    id
) {

    const updates = {

        name:
            getValue(
                "editCustomerName"
            ),

        phone:
            getValue(
                "editCustomerPhone"
            ),

        address:
            getValue(
                "editCustomerAddress"
            ),

        balance:
            toNumber(
                getValue(
                    "editCustomerBalance"
                )
            ),

        notes:
            getValue(
                "editCustomerNotes"
            ),

        updatedAt:
            serverTimestamp()

    };


    if (!updates.name) {

        showToast(
            "اسم العميل مطلوب",
            "warning"
        );

        return;

    }


    try {

        await updateDoc(
            doc(
                db,
                COLLECTIONS.customers,
                id
            ),
            updates
        );


        const index =
            systemData.customers.findIndex(
                item =>
                    item.id === id
            );


        if (index !== -1) {

            systemData.customers[index] = {

                ...systemData.customers[index],

                ...updates

            };

        }


        closeModal();

        refreshCurrentPage();

        showToast(
            "تم تعديل العميل",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر تعديل العميل",
            "error"
        );

    }

}


// =========================================================
// حذف عميل
// =========================================================

async function deleteCustomer(
    id
) {

    if (
        !confirm(
            "هل تريد حذف العميل؟"
        )
    ) {

        return;

    }


    try {

        await deleteDoc(
            doc(
                db,
                COLLECTIONS.customers,
                id
            )
        );


        systemData.customers =
            systemData.customers.filter(
                item =>
                    item.id !== id
            );


        refreshCurrentPage();

        showToast(
            "تم حذف العميل",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حذف العميل",
            "error"
        );

    }

}


// =========================================================
// الموردون - إضافة
// =========================================================

function newSupplier() {

    openModal(
        "إضافة مورد",
        `
        <form>

            <div class="form-grid">

                <div class="form-group">

                    <label>اسم المورد *</label>

                    <input
                        id="supplierName"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>الهاتف</label>

                    <input
                        id="supplierPhone"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>العنوان</label>

                    <input
                        id="supplierAddress"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>الرصيد</label>

                    <input
                        id="supplierBalance"
                        type="number"
                        step="0.01"
                        value="0"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>ملاحظات</label>

                    <textarea
                        id="supplierNotes"
                        class="form-control"></textarea>

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ",
                className: "btn btn-primary",
                action: saveNewSupplier
            }
        ]
    );

}


// =========================================================
// حفظ المورد
// =========================================================

async function saveNewSupplier() {

    const name =
        getValue(
            "supplierName"
        );


    if (!name) {

        showToast(
            "اسم المورد مطلوب",
            "warning"
        );

        return;

    }


    const supplier = {

        name,

        phone:
            getValue(
                "supplierPhone"
            ),

        address:
            getValue(
                "supplierAddress"
            ),

        balance:
            toNumber(
                getValue(
                    "supplierBalance"
                )
            ),

        notes:
            getValue(
                "supplierNotes"
            ),

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    try {

        const reference =
            await addDoc(
                collection(
                    db,
                    COLLECTIONS.suppliers
                ),
                supplier
            );


        systemData.suppliers.push({

            id:
                reference.id,

            ...supplier,

            createdAt:
                new Date()
                    .toISOString(),

            updatedAt:
                new Date()
                    .toISOString()

        });


        closeModal();

        refreshCurrentPage();

        showToast(
            "تم إضافة المورد",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حفظ المورد",
            "error"
        );

    }

}


// =========================================================
// تعديل المورد
// =========================================================

function editSupplier(
    id
) {

    const supplier =
        systemData.suppliers.find(
            item =>
                item.id === id
        );


    if (!supplier) return;


    openModal(
        "تعديل المورد",
        `
        <form>

            <div class="form-grid">

                <div class="form-group">

                    <label>اسم المورد *</label>

                    <input
                        id="editSupplierName"
                        class="form-control"
                        value="${escapeAttribute(
                            supplier.name
                        )}">

                </div>


                <div class="form-group">

                    <label>الهاتف</label>

                    <input
                        id="editSupplierPhone"
                        class="form-control"
                        value="${escapeAttribute(
                            supplier.phone
                        )}">

                </div>


                <div class="form-group">

                    <label>العنوان</label>

                    <input
                        id="editSupplierAddress"
                        class="form-control"
                        value="${escapeAttribute(
                            supplier.address
                        )}">

                </div>


                <div class="form-group">

                    <label>الرصيد</label>

                    <input
                        id="editSupplierBalance"
                        type="number"
                        step="0.01"
                        class="form-control"
                        value="${toNumber(
                            supplier.balance
                        )}">

                </div>


                <div class="form-group">

                    <label>ملاحظات</label>

                    <textarea
                        id="editSupplierNotes"
                        class="form-control">${escapeHtml(
                            supplier.notes || ""
                        )}</textarea>

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ التعديل",
                className: "btn btn-primary",
                action: () =>
                    updateSupplier(
                        id
                    )
            }
        ]
    );

}


// =========================================================
// تحديث المورد
// =========================================================

async function updateSupplier(
    id
) {

    const updates = {

        name:
            getValue(
                "editSupplierName"
            ),

        phone:
            getValue(
                "editSupplierPhone"
            ),

        address:
            getValue(
                "editSupplierAddress"
            ),

        balance:
            toNumber(
                getValue(
                    "editSupplierBalance"
                )
            ),

        notes:
            getValue(
                "editSupplierNotes"
            ),

        updatedAt:
            serverTimestamp()

    };


    if (!updates.name) {

        showToast(
            "اسم المورد مطلوب",
            "warning"
        );

        return;

    }


    try {

        await updateDoc(
            doc(
                db,
                COLLECTIONS.suppliers,
                id
            ),
            updates
        );


        const index =
            systemData.suppliers.findIndex(
                item =>
                    item.id === id
            );


        if (index !== -1) {

            systemData.suppliers[index] = {

                ...systemData.suppliers[index],

                ...updates

            };

        }


        closeModal();

        refreshCurrentPage();

        showToast(
            "تم تعديل المورد",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر تعديل المورد",
            "error"
        );

    }

}


// =========================================================
// حذف المورد
// =========================================================

async function deleteSupplier(
    id
) {

    if (
        !confirm(
            "هل تريد حذف المورد؟"
        )
    ) {

        return;

    }


    try {

        await deleteDoc(
            doc(
                db,
                COLLECTIONS.suppliers,
                id
            )
        );


        systemData.suppliers =
            systemData.suppliers.filter(
                item =>
                    item.id !== id
            );


        refreshCurrentPage();

        showToast(
            "تم حذف المورد",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حذف المورد",
            "error"
        );

    }

}


// =========================================================
// العمال - إضافة
// =========================================================

function newEmployee() {

    openModal(
        "إضافة عامل",
        `
        <form>

            <div class="form-grid">

                <div class="form-group">

                    <label>الاسم *</label>

                    <input
                        id="employeeName"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>الهاتف</label>

                    <input
                        id="employeePhone"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>الرقم القومي</label>

                    <input
                        id="employeeNationalId"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>الوظيفة</label>

                    <input
                        id="employeeJob"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>نوع الأجر</label>

                    <select
                        id="employeeSalaryType"
                        class="form-control">

                        <option value="شهري">
                            شهري
                        </option>

                        <option value="يومي">
                            يومي
                        </option>

                        <option value="بالساعة">
                            بالساعة
                        </option>

                    </select>

                </div>


                <div class="form-group">

                    <label>قيمة الأجر</label>

                    <input
                        id="employeeSalary"
                        type="number"
                        step="0.01"
                        min="0"
                        value="0"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>ملاحظات</label>

                    <textarea
                        id="employeeNotes"
                        class="form-control"></textarea>

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ",
                className: "btn btn-primary",
                action: saveNewEmployee
            }
        ]
    );

}


// =========================================================
// حفظ عامل
// =========================================================

async function saveNewEmployee() {

    const name =
        getValue(
            "employeeName"
        );


    if (!name) {

        showToast(
            "اسم العامل مطلوب",
            "warning"
        );

        return;

    }


    const employee = {

        name,

        phone:
            getValue(
                "employeePhone"
            ),

        nationalId:
            getValue(
                "employeeNationalId"
            ),

        job:
            getValue(
                "employeeJob"
            ),

        salaryType:
            getValue(
                "employeeSalaryType"
            ) || "شهري",

        salary:
            toNumber(
                getValue(
                    "employeeSalary"
                )
            ),

        notes:
            getValue(
                "employeeNotes"
            ),

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    try {

        const reference =
            await addDoc(
                collection(
                    db,
                    COLLECTIONS.employees
                ),
                employee
            );


        systemData.employees.push({

            id:
                reference.id,

            ...employee

        });


        closeModal();

        refreshCurrentPage();

        showToast(
            "تم إضافة العامل",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حفظ العامل",
            "error"
        );

    }

}


// =========================================================
// إنشاء حساب دخول لعامل (Cloud Function createEmployee)
// =========================================================

function newEmployeeAccount() {

    if (
        !currentUser ||
        currentUser.role !== "admin"
    ) {

        showToast(
            "هاي الميزة للمدير فقط",
            "warning"
        );

        return;

    }


    const pageLabels = {

        dashboard: "لوحة التحكم",
        sales: "المبيعات",
        purchases: "المشتريات",
        expenses: "المصروفات",
        inventory: "المخزون",
        customers: "العملاء",
        suppliers: "الموردين",
        employees: "العمال",
        investors: "المستثمرين",
        reports: "التقارير",
        analysis: "التحليل",
        settings: "الإعدادات"

    };


    openModal(
        "إنشاء حساب دخول للنظام",
        `
        <form>

            <div class="form-grid">

                <div class="form-group">
                    <label>الاسم الكامل *</label>
                    <input
                        id="newAccountName"
                        class="form-control">
                </div>

                <div class="form-group">
                    <label>البريد الإلكتروني *</label>
                    <input
                        id="newAccountEmail"
                        type="email"
                        class="form-control">
                </div>

                <div class="form-group">
                    <label>كلمة المرور (6 أحرف على الأقل) *</label>
                    <input
                        id="newAccountPassword"
                        type="password"
                        class="form-control">
                </div>

            </div>


            <div class="form-group" style="margin-top:16px;">

                <label>الصفحات المسموح له بالوصول إليها</label>

                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;">

                    ${
                        Object.entries(pageLabels).map(
                            ([key, label]) => `
                            <label style="display:flex;align-items:center;gap:6px;font-weight:normal;">
                                <input
                                    type="checkbox"
                                    class="new-account-permission"
                                    value="${key}">
                                ${label}
                            </label>
                        `
                        ).join("")
                    }

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "إنشاء الحساب",
                className: "btn btn-primary",
                action: saveEmployeeAccount
            }
        ]
    );

}


async function saveEmployeeAccount() {

    const name =
        getValue(
            "newAccountName"
        );

    const email =
        getValue(
            "newAccountEmail"
        );

    const password =
        getValue(
            "newAccountPassword"
        );


    if (
        !name ||
        !email ||
        !password
    ) {

        showToast(
            "الاسم والبريد الإلكتروني وكلمة المرور مطلوبين",
            "warning"
        );

        return;

    }


    if (password.length < 6) {

        showToast(
            "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
            "warning"
        );

        return;

    }


    const permissions = {};

    document.querySelectorAll(
        ".new-account-permission"
    ).forEach(
        checkbox => {

            permissions[checkbox.value] =
                checkbox.checked;

        }
    );


    try {

        showToast(
            "جاري إنشاء الحساب...",
            "info"
        );

        const createEmployeeCallable =
            httpsCallable(
                functions,
                "createEmployee"
            );

        const result =
            await createEmployeeCallable(
                {
                    email,
                    password,
                    name,
                    permissions
                }
            );

        closeModal();

        showToast(
            result?.data?.message ||
            "تم إنشاء حساب الموظف بنجاح",
            "success"
        );

    } catch (error) {

        console.error(
            "createEmployee error:",
            error
        );

        showToast(
            error?.message ||
            "تعذر إنشاء الحساب",
            "error"
        );

    }

}


// =========================================================
// تعديل العامل
// =========================================================

function editEmployee(
    id
) {

    const employee =
        systemData.employees.find(
            item =>
                item.id === id
        );


    if (!employee) return;


    openModal(
        "تعديل العامل",
        `
        <form>

            <div class="form-grid">

                <div class="form-group">

                    <label>الاسم *</label>

                    <input
                        id="editEmployeeName"
                        class="form-control"
                        value="${escapeAttribute(
                            employee.name
                        )}">

                </div>


                <div class="form-group">

                    <label>الهاتف</label>

                    <input
                        id="editEmployeePhone"
                        class="form-control"
                        value="${escapeAttribute(
                            employee.phone
                        )}">

                </div>


                <div class="form-group">

                    <label>الرقم القومي</label>

                    <input
                        id="editEmployeeNationalId"
                        class="form-control"
                        value="${escapeAttribute(
                            employee.nationalId
                        )}">

                </div>


                <div class="form-group">

                    <label>الوظيفة</label>

                    <input
                        id="editEmployeeJob"
                        class="form-control"
                        value="${escapeAttribute(
                            employee.job
                        )}">

                </div>


                <div class="form-group">

                    <label>نوع الأجر</label>

                    <select
                        id="editEmployeeSalaryType"
                        class="form-control">

                        <option
                            value="شهري"
                            ${
                                employee.salaryType ===
                                "شهري"
                                ?
                                "selected"
                                :
                                ""
                            }>
                            شهري
                        </option>

                        <option
                            value="يومي"
                            ${
                                employee.salaryType ===
                                "يومي"
                                ?
                                "selected"
                                :
                                ""
                            }>
                            يومي
                        </option>

                        <option
                            value="بالساعة"
                            ${
                                employee.salaryType ===
                                "بالساعة"
                                ?
                                "selected"
                                :
                                ""
                            }>
                            بالساعة
                        </option>

                    </select>

                </div>


                <div class="form-group">

                    <label>قيمة الأجر</label>

                    <input
                        id="editEmployeeSalary"
                        type="number"
                        step="0.01"
                        min="0"
                        class="form-control"
                        value="${toNumber(
                            employee.salary
                        )}">

                </div>


                <div class="form-group">

                    <label>ملاحظات</label>

                    <textarea
                        id="editEmployeeNotes"
                        class="form-control">${escapeHtml(
                            employee.notes || ""
                        )}</textarea>

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ التعديل",
                className: "btn btn-primary",
                action: () =>
                    updateEmployee(
                        id
                    )
            }
        ]
    );

}


// =========================================================
// تحديث العامل
// =========================================================

async function updateEmployee(
    id
) {

    const updates = {

        name:
            getValue(
                "editEmployeeName"
            ),

        phone:
            getValue(
                "editEmployeePhone"
            ),

        nationalId:
            getValue(
                "editEmployeeNationalId"
            ),

        job:
            getValue(
                "editEmployeeJob"
            ),

        salaryType:
            getValue(
                "editEmployeeSalaryType"
            ),

        salary:
            toNumber(
                getValue(
                    "editEmployeeSalary"
                )
            ),

        notes:
            getValue(
                "editEmployeeNotes"
            ),

        updatedAt:
            serverTimestamp()

    };


    if (!updates.name) {

        showToast(
            "اسم العامل مطلوب",
            "warning"
        );

        return;

    }


    try {

        await updateDoc(
            doc(
                db,
                COLLECTIONS.employees,
                id
            ),
            updates
        );


        const index =
            systemData.employees.findIndex(
                item =>
                    item.id === id
            );


        if (index !== -1) {

            systemData.employees[index] = {

                ...systemData.employees[index],

                ...updates

            };

        }


        closeModal();

        refreshCurrentPage();

        showToast(
            "تم تعديل العامل",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر تعديل العامل",
            "error"
        );

    }

}


// =========================================================
// حذف العامل
// =========================================================

async function deleteEmployee(
    id
) {

    if (
        !confirm(
            "هل تريد حذف العامل؟"
        )
    ) {

        return;

    }


    try {

        await deleteDoc(
            doc(
                db,
                COLLECTIONS.employees,
                id
            )
        );


        systemData.employees =
            systemData.employees.filter(
                item =>
                    item.id !== id
            );


        refreshCurrentPage();

        showToast(
            "تم حذف العامل",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حذف العامل",
            "error"
        );

    }

}


// =========================================================
// المستثمرون - إضافة
// =========================================================

function newInvestor() {

    openModal(
        "إضافة مستثمر",
        `
        <form>

            <div class="form-grid">

                <div class="form-group">

                    <label>اسم المستثمر *</label>

                    <input
                        id="investorName"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>الهاتف</label>

                    <input
                        id="investorPhone"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>رأس المال</label>

                    <input
                        id="investorCapital"
                        type="number"
                        step="0.01"
                        min="0"
                        value="0"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>ملاحظات</label>

                    <textarea
                        id="investorNotes"
                        class="form-control"></textarea>

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ",
                className: "btn btn-primary",
                action: saveNewInvestor
            }
        ]
    );

}


// =========================================================
// حفظ مستثمر
// =========================================================

async function saveNewInvestor() {

    const name =
        getValue(
            "investorName"
        );


    if (!name) {

        showToast(
            "اسم المستثمر مطلوب",
            "warning"
        );

        return;

    }


    const investor = {

        name,

        phone:
            getValue(
                "investorPhone"
            ),

        capital:
            toNumber(
                getValue(
                    "investorCapital"
                )
            ),

        notes:
            getValue(
                "investorNotes"
            ),

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    try {

        const reference =
            await addDoc(
                collection(
                    db,
                    COLLECTIONS.investors
                ),
                investor
            );


        systemData.investors.push({

            id:
                reference.id,

            ...investor

        });


        closeModal();

        refreshCurrentPage();

        showToast(
            "تم إضافة المستثمر",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حفظ المستثمر",
            "error"
        );

    }

}


// =========================================================
// تعديل المستثمر
// =========================================================

function editInvestor(
    id
) {

    const investor =
        systemData.investors.find(
            item =>
                item.id === id
        );


    if (!investor) return;


    openModal(
        "تعديل المستثمر",
        `
        <form>

            <div class="form-grid">

                <div class="form-group">

                    <label>اسم المستثمر *</label>

                    <input
                        id="editInvestorName"
                        class="form-control"
                        value="${escapeAttribute(
                            investor.name
                        )}">

                </div>


                <div class="form-group">

                    <label>الهاتف</label>

                    <input
                        id="editInvestorPhone"
                        class="form-control"
                        value="${escapeAttribute(
                            investor.phone
                        )}">

                </div>


                <div class="form-group">

                    <label>رأس المال</label>

                    <input
                        id="editInvestorCapital"
                        type="number"
                        step="0.01"
                        min="0"
                        class="form-control"
                        value="${toNumber(
                            investor.capital
                        )}">

                </div>


                <div class="form-group">

                    <label>ملاحظات</label>

                    <textarea
                        id="editInvestorNotes"
                        class="form-control">${escapeHtml(
                            investor.notes || ""
                        )}</textarea>

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ التعديل",
                className: "btn btn-primary",
                action: () =>
                    updateInvestor(
                        id
                    )
            }
        ]
    );

}


// =========================================================
// تحديث المستثمر
// =========================================================

async function updateInvestor(
    id
) {

    const updates = {

        name:
            getValue(
                "editInvestorName"
            ),

        phone:
            getValue(
                "editInvestorPhone"
            ),

        capital:
            toNumber(
                getValue(
                    "editInvestorCapital"
                )
            ),

        notes:
            getValue(
                "editInvestorNotes"
            ),

        updatedAt:
            serverTimestamp()

    };


    if (!updates.name) {

        showToast(
            "اسم المستثمر مطلوب",
            "warning"
        );

        return;

    }


    try {

        await updateDoc(
            doc(
                db,
                COLLECTIONS.investors,
                id
            ),
            updates
        );


        const index =
            systemData.investors.findIndex(
                item =>
                    item.id === id
            );


        if (index !== -1) {

            systemData.investors[index] = {

                ...systemData.investors[index],

                ...updates

            };

        }


        closeModal();

        refreshCurrentPage();

        showToast(
            "تم تعديل المستثمر",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر تعديل المستثمر",
            "error"
        );

    }

}


// =========================================================
// حذف المستثمر
// =========================================================

async function deleteInvestor(
    id
) {

    if (
        !confirm(
            "هل تريد حذف المستثمر؟"
        )
    ) {

        return;

    }


    try {

        await deleteDoc(
            doc(
                db,
                COLLECTIONS.investors,
                id
            )
        );


        systemData.investors =
            systemData.investors.filter(
                item =>
                    item.id !== id
            );


        refreshCurrentPage();

        showToast(
            "تم حذف المستثمر",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حذف المستثمر",
            "error"
        );

    }

}


// =========================================================
// المصروفات - إضافة
// =========================================================

function newExpense() {

    openModal(
        "إضافة مصروف",
        `
        <form>

            <div class="form-grid">

                <div class="form-group">

                    <label>التاريخ</label>

                    <input
                        id="expenseDate"
                        type="date"
                        class="form-control"
                        value="${
                            new Date()
                                .toISOString()
                                .split("T")[0]
                        }">

                </div>


                <div class="form-group">

                    <label>نوع المصروف</label>

                    <input
                        id="expenseCategory"
                        class="form-control"
                        placeholder="رواتب، كهرباء، نقل...">

                </div>


                <div class="form-group">

                    <label>المبلغ *</label>

                    <input
                        id="expenseAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>البيان</label>

                    <input
                        id="expenseDescription"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>ملاحظات</label>

                    <textarea
                        id="expenseNotes"
                        class="form-control"></textarea>

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ",
                className: "btn btn-primary",
                action: saveNewExpense
            }
        ]
    );

}


// =========================================================
// حفظ مصروف
// =========================================================

async function saveNewExpense() {

    const amount =
        toNumber(
            getValue(
                "expenseAmount"
            )
        );


    if (amount <= 0) {

        showToast(
            "أدخل مبلغًا صحيحًا",
            "warning"
        );

        return;

    }


    const expense = {

        date:
            getValue(
                "expenseDate"
            ),

        category:
            getValue(
                "expenseCategory"
            ),

        amount,

        description:
            getValue(
                "expenseDescription"
            ),

        notes:
            getValue(
                "expenseNotes"
            ),

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    try {

        const reference =
            await addDoc(
                collection(
                    db,
                    COLLECTIONS.expenses
                ),
                expense
            );


        systemData.expenses.push({

            id:
                reference.id,

            ...expense

        });


        closeModal();

        refreshCurrentPage();

        showToast(
            "تم إضافة المصروف",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حفظ المصروف",
            "error"
        );

    }

}


// =========================================================
// تعديل مصروف
// =========================================================

function editExpense(
    id
) {

    const expense =
        systemData.expenses.find(
            item =>
                item.id === id
        );


    if (!expense) return;


    openModal(
        "تعديل المصروف",
        `
        <form>

            <div class="form-grid">

                <div class="form-group">

                    <label>التاريخ</label>

                    <input
                        id="editExpenseDate"
                        type="date"
                        class="form-control"
                        value="${escapeAttribute(
                            getRecordDate(
                                expense
                            )
                        )}">

                </div>


                <div class="form-group">

                    <label>نوع المصروف</label>

                    <input
                        id="editExpenseCategory"
                        class="form-control"
                        value="${escapeAttribute(
                            expense.category
                        )}">

                </div>


                <div class="form-group">

                    <label>المبلغ</label>

                    <input
                        id="editExpenseAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        class="form-control"
                        value="${toNumber(
                            expense.amount
                        )}">

                </div>


                <div class="form-group">

                    <label>البيان</label>

                    <input
                        id="editExpenseDescription"
                        class="form-control"
                        value="${escapeAttribute(
                            expense.description
                        )}">

                </div>


                <div class="form-group">

                    <label>ملاحظات</label>

                    <textarea
                        id="editExpenseNotes"
                        class="form-control">${escapeHtml(
                            expense.notes || ""
                        )}</textarea>

                </div>

            </div>

        </form>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ التعديل",
                className: "btn btn-primary",
                action: () =>
                    updateExpense(
                        id
                    )
            }
        ]
    );

}


// =========================================================
// تحديث المصروف
// =========================================================

async function updateExpense(
    id
) {

    const updates = {

        date:
            getValue(
                "editExpenseDate"
            ),

        category:
            getValue(
                "editExpenseCategory"
            ),

        amount:
            toNumber(
                getValue(
                    "editExpenseAmount"
                )
            ),

        description:
            getValue(
                "editExpenseDescription"
            ),

        notes:
            getValue(
                "editExpenseNotes"
            ),

        updatedAt:
            serverTimestamp()

    };


    if (
        updates.amount <= 0
    ) {

        showToast(
            "أدخل مبلغًا صحيحًا",
            "warning"
        );

        return;

    }


    try {

        await updateDoc(
            doc(
                db,
                COLLECTIONS.expenses,
                id
            ),
            updates
        );


        const index =
            systemData.expenses.findIndex(
                item =>
                    item.id === id
            );


        if (index !== -1) {

            systemData.expenses[index] = {

                ...systemData.expenses[index],

                ...updates

            };

        }


        closeModal();

        refreshCurrentPage();

        showToast(
            "تم تعديل المصروف",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر تعديل المصروف",
            "error"
        );

    }

}


// =========================================================
// حذف المصروف
// =========================================================

async function deleteExpense(
    id
) {

    if (
        !confirm(
            "هل تريد حذف المصروف؟"
        )
    ) {

        return;

    }


    try {

        await deleteDoc(
            doc(
                db,
                COLLECTIONS.expenses,
                id
            )
        );


        systemData.expenses =
            systemData.expenses.filter(
                item =>
                    item.id !== id
            );


        refreshCurrentPage();

        showToast(
            "تم حذف المصروف",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حذف المصروف",
            "error"
        );

    }

}


// =========================================================
// إنشاء فاتورة شراء
// =========================================================

function newPurchase() {

    let cart = [];


    openModal(
        "فاتورة شراء جديدة",
        `
        <div>

            <div class="form-grid">

                <div class="form-group">

                    <label>رقم الفاتورة</label>

                    <input
                        id="purchaseInvoiceNumber"
                        class="form-control"
                        value="${generateInvoiceNumber(
                            "PUR"
                        )}">

                </div>


                <div class="form-group">

                    <label>التاريخ</label>

                    <input
                        id="purchaseDate"
                        type="date"
                        class="form-control"
                        value="${
                            new Date()
                                .toISOString()
                                .split("T")[0]
                        }">

                </div>


                <div class="form-group">

                    <label>المورد</label>

                    <div class="search-results">

                        <input
                            id="purchaseSupplierSearch"
                            class="form-control"
                            placeholder="ابحث باسم المورد..."
                            oninput="searchPurchaseSuppliers(this.value)">

                        <input
                            id="purchaseSupplier"
                            type="hidden">

                        <div
                            id="purchaseSupplierResults"
                            class="search-results-list">
                        </div>

                    </div>

                </div>


                <div class="form-group">

                    <label>العملة</label>

                    <select
                        id="purchaseCurrency"
                        class="form-control">

                        <option value="EGP">
                            EGP
                        </option>

                        <option value="USD">
                            USD
                        </option>

                        <option value="SAR">
                            SAR
                        </option>

                        <option value="EUR">
                            EUR
                        </option>

                    </select>

                </div>


                <div class="form-group">

                    <label>
                        سعر الصرف مقابل العملة الأساسية
                    </label>

                    <input
                        id="purchaseExchangeRate"
                        type="number"
                        min="0.000001"
                        step="0.000001"
                        class="form-control"
                        value="1">

                </div>

            </div>


            <hr>


            <h4>
                إضافة صنف
            </h4>


            <div class="form-grid">

                <div class="form-group">

                    <label>الصنف</label>

                    <div class="search-results">

                        <input
                            id="purchaseProductSearch"
                            class="form-control"
                            placeholder="ابحث باسم الصنف أو الكود أو الباركود..."
                            oninput="searchPurchaseProducts(this.value)">

                        <input
                            id="purchaseProduct"
                            type="hidden">

                        <div
                            id="purchaseProductResults"
                            class="search-results-list">
                        </div>

                    </div>

                </div>


                <div class="form-group">

                    <label>الكمية</label>

                    <input
                        id="purchaseQuantity"
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        class="form-control"
                        value="1">

                </div>


                <div class="form-group">

                    <label>سعر الوحدة</label>

                    <input
                        id="purchaseUnitPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        class="form-control"
                        value="0">

                </div>


                <div class="form-group">

                    <label>سعر البيع المقترح</label>

                    <input
                        id="purchaseSellPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        class="form-control"
                        value="0">

                </div>

            </div>


            <button
                type="button"
                class="btn btn-primary"
                onclick="addPurchaseItem()">

                + إضافة للصورة

            </button>


            <div
                id="purchaseCart"
                class="cart-table">

                <div class="empty-state">
                    لم تتم إضافة أصناف
                </div>

            </div>


            <div class="extra-expenses-section">

                <h4>
                    المصروفات الإضافية على الشحنة
                </h4>


                <div class="extra-expenses-grid">

                    <div class="form-group">

                        <label>
                            الشحن
                        </label>

                        <input
                            id="purchaseShipping"
                            type="number"
                            min="0"
                            step="0.01"
                            value="0"
                            class="form-control"
                            oninput="updatePurchaseTotals()">

                    </div>


                    <div class="form-group">

                        <label>
                            الجمارك
                        </label>

                        <input
                            id="purchaseCustoms"
                            type="number"
                            min="0"
                            step="0.01"
                            value="0"
                            class="form-control"
                            oninput="updatePurchaseTotals()">

                    </div>


                    <div class="form-group">

                        <label>
                            التخليص
                        </label>

                        <input
                            id="purchaseClearance"
                            type="number"
                            min="0"
                            step="0.01"
                            value="0"
                            class="form-control"
                            oninput="updatePurchaseTotals()">

                    </div>


                    <div class="form-group">

                        <label>
                            النقل
                        </label>

                        <input
                            id="purchaseTransport"
                            type="number"
                            min="0"
                            step="0.01"
                            value="0"
                            class="form-control"
                            oninput="updatePurchaseTotals()">

                    </div>


                    <div class="form-group">

                        <label>
                            التأمين
                        </label>

                        <input
                            id="purchaseInsurance"
                            type="number"
                            min="0"
                            step="0.01"
                            value="0"
                            class="form-control"
                            oninput="updatePurchaseTotals()">

                    </div>


                    <div class="form-group">

                        <label>
                            مصروفات أخرى
                        </label>

                        <input
                            id="purchaseOtherExpenses"
                            type="number"
                            min="0"
                            step="0.01"
                            value="0"
                            class="form-control"
                            oninput="updatePurchaseTotals()">

                    </div>

                </div>


                <div class="extra-expenses-total">

                    <span>
                        إجمالي المصروفات الإضافية
                    </span>

                    <strong
                        id="purchaseExtraExpenses">
                        0
                    </strong>

                </div>

            </div>


            <div class="invoice-summary">

                <div class="summary-box">

                    <span>
                        إجمالي الأصناف
                    </span>

                    <strong
                        id="purchaseTotal">
                        0
                    </strong>

                </div>


                <div class="summary-box">

                    <span>
                        المصروفات الإضافية
                    </span>

                    <strong
                        id="purchaseExtraExpensesSummary">
                        0
                    </strong>

                </div>


                <div class="summary-box">

                    <span>
                        التكلفة الفعلية
                    </span>

                    <strong
                        id="purchaseGrandTotal">
                        0
                    </strong>

                </div>

            </div>

        </div>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ الفاتورة",
                className: "btn btn-primary",
                action: () =>
                    savePurchaseFromModal(
                        cart
                    )
            }
        ],
        "modal-large"
    );


    window.purchaseModalCart =
        cart;

}


// =========================================================
// البحث عن مورد داخل فاتورة الشراء
// =========================================================

function searchPurchaseSuppliers(
    text
) {

    const container =
        document.getElementById(
            "purchaseSupplierResults"
        );


    if (!container) return;


    const value =
        normalizeSearchText(
            text
        );


    if (!value) {

        container.innerHTML = "";

        return;

    }


    const suppliers =
        systemData.suppliers.filter(
            supplier =>
                matchesSearch(
                    [
                        supplier.name,
                        supplier.phone,
                        supplier.address
                    ],
                    value
                )
        );


    if (!suppliers.length) {

        container.innerHTML =
            `<div class="search-result-item">
                لا يوجد مورد مطابق
            </div>`;

        return;

    }


    container.innerHTML =
        suppliers
            .slice(
                0,
                10
            )
            .map(
                supplier => `

                <div
                    class="search-result-item"
                    onclick="selectPurchaseSupplier('${supplier.id}')">

                    <strong>
                        ${escapeHtml(
                            supplier.name
                        )}
                    </strong>

                    <small>
                        ${escapeHtml(
                            supplier.phone ||
                            ""
                        )}
                    </small>

                </div>

            `
            )
            .join("");

}


// =========================================================
// اختيار المورد
// =========================================================

function selectPurchaseSupplier(
    id
) {

    const supplier =
        systemData.suppliers.find(
            item =>
                item.id === id
        );


    if (!supplier) return;


    setInputValue(
        "purchaseSupplier",
        supplier.id
    );


    setInputValue(
        "purchaseSupplierSearch",
        supplier.name
    );


    const results =
        document.getElementById(
            "purchaseSupplierResults"
        );


    if (results) {

        results.innerHTML = "";

    }

}


// =========================================================
// البحث عن أصناف الشراء
// =========================================================

function searchPurchaseProducts(
    text
) {

    const container =
        document.getElementById(
            "purchaseProductResults"
        );


    if (!container) return;


    const value =
        normalizeSearchText(
            text
        );


    if (!value) {

        container.innerHTML = "";

        return;

    }


    const products =
        systemData.products.filter(
            product =>
                matchesSearch(
                    [
                        product.name,
                        product.code,
                        product.barcode,
                        product.category
                    ],
                    value
                )
        );


    if (!products.length) {

        container.innerHTML =
            `<div class="search-result-item">
                لا يوجد صنف مطابق
            </div>`;

        return;

    }


    container.innerHTML =
        products
            .slice(
                0,
                15
            )
            .map(
                product => `

                <div
                    class="search-result-item"
                    onclick="selectPurchaseProduct('${product.id}')">

                    <strong>
                        ${escapeHtml(
                            product.name
                        )}
                    </strong>

                    <small>
                        الكود:
                        ${escapeHtml(
                            product.code ||
                            "-"
                        )}
                        |
                        التكلفة:
                        ${formatMoney(
                            product.buyPrice ??
                            product.averageCost
                        )}
                    </small>

                </div>

            `
            )
            .join("");

}


// =========================================================
// اختيار صنف الشراء
// =========================================================

function selectPurchaseProduct(
    id
) {

    const product =
        systemData.products.find(
            item =>
                item.id === id
        );


    if (!product) return;


    setInputValue(
        "purchaseProduct",
        product.id
    );


    setInputValue(
        "purchaseProductSearch",
        product.name
    );


    setInputValue(
        "purchaseUnitPrice",
        toNumber(
            product.buyPrice ??
            product.averageCost
        )
    );


    setInputValue(
        "purchaseSellPrice",
        toNumber(
            product.sellPrice
        )
    );


    const results =
        document.getElementById(
            "purchaseProductResults"
        );


    if (results) {

        results.innerHTML = "";

    }

}


// =========================================================
// إضافة صنف إلى فاتورة الشراء
// =========================================================

function addPurchaseItem() {

    const productId =
        getValue(
            "purchaseProduct"
        );


    const product =
        systemData.products.find(
            item =>
                item.id === productId
        );


    if (!product) {

        showToast(
            "اختر صنفًا أولًا",
            "warning"
        );

        return;

    }


    const quantity =
        toNumber(
            getValue(
                "purchaseQuantity"
            )
        );


    const unitPrice =
        toNumber(
            getValue(
                "purchaseUnitPrice"
            )
        );


    const sellPrice =
        toNumber(
            getValue(
                "purchaseSellPrice"
            )
        );


    if (
        quantity <= 0 ||
        unitPrice < 0
    ) {

        showToast(
            "راجع الكمية والسعر",
            "warning"
        );

        return;

    }


    const item = {

        productId,

        productName:
            product.name,

        quantity,

        unitPrice,

        sellPrice,

        total:
            quantity *
            unitPrice

    };


    if (
        !window.purchaseModalCart
    ) {

        window.purchaseModalCart =
            [];

    }


    window.purchaseModalCart.push(
        item
    );


    renderPurchaseCart();

    updatePurchaseTotals();


    setInputValue(
        "purchaseProduct",
        ""
    );


    setInputValue(
        "purchaseProductSearch",
        ""
    );


    setInputValue(
        "purchaseQuantity",
        "1"
    );


    setInputValue(
        "purchaseUnitPrice",
        "0"
    );


    setInputValue(
        "purchaseSellPrice",
        "0"
    );

}


// =========================================================
// عرض سلة الشراء
// =========================================================

function renderPurchaseCart() {

    const container =
        document.getElementById(
            "purchaseCart"
        );


    if (!container) return;


    const cart =
        window.purchaseModalCart ||
        [];


    if (!cart.length) {

        container.innerHTML =
            `<div class="empty-state">
                لم تتم إضافة أصناف
            </div>`;

        return;

    }


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>الصنف</th>

                    <th>الكمية</th>

                    <th>سعر الوحدة</th>

                    <th>الإجمالي</th>

                    <th>الإجراء</th>

                </tr>

            </thead>

            <tbody>

                ${cart.map(
                    (
                        item,
                        index
                    ) => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                item.productName
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                item.quantity
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                item.unitPrice
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                item.total
                            )}
                        </td>

                        <td>

                            <button
                                class="btn btn-danger btn-sm"
                                onclick="removePurchaseItem(${index})">

                                حذف

                            </button>

                        </td>

                    </tr>

                `
                ).join("")}

            </tbody>

        </table>

    `;

}


// =========================================================
// حذف صنف من فاتورة الشراء
// =========================================================

function removePurchaseItem(
    index
) {

    if (
        !window.purchaseModalCart
    ) return;


    window.purchaseModalCart.splice(
        index,
        1
    );


    renderPurchaseCart();

    updatePurchaseTotals();

}


// =========================================================
// حساب إجمالي المصروفات الإضافية
// =========================================================

function calculatePurchaseExtraExpenses() {

    const fields = [

        "purchaseShipping",

        "purchaseCustoms",

        "purchaseClearance",

        "purchaseTransport",

        "purchaseInsurance",

        "purchaseOtherExpenses"

    ];


    return fields.reduce(
        (
            total,
            id
        ) =>
            total +
            toNumber(
                getValue(id)
            ),
        0
    );

}


// =========================================================
// تحديث إجمالي فاتورة الشراء
// =========================================================

function updatePurchaseTotals() {

    const cart =
        window.purchaseModalCart ||
        [];


    const total =
        cart.reduce(
            (
                sum,
                item
            ) =>
                sum +
                toNumber(
                    item.total
                ),
            0
        );


    const extraExpenses =
        calculatePurchaseExtraExpenses();


    const grandTotal =
        total +
        extraExpenses;


    setText(
        "purchaseTotal",
        formatMoney(total)
    );


    setText(
        "purchaseExtraExpenses",
        formatMoney(
            extraExpenses
        )
    );


    setText(
        "purchaseExtraExpensesSummary",
        formatMoney(
            extraExpenses
        )
    );


    setText(
        "purchaseGrandTotal",
        formatMoney(
            grandTotal
        )
    );

}


// =========================================================
// حفظ فاتورة الشراء
// =========================================================

async function savePurchaseFromModal(
    cart
) {

    cart =
        window.purchaseModalCart ||
        cart ||
        [];


    if (!cart.length) {

        showToast(
            "أضف صنفًا واحدًا على الأقل",
            "warning"
        );

        return;

    }


    const total =
        cart.reduce(
            (
                sum,
                item
            ) =>
                sum +
                (
                    toNumber(
                        item.quantity
                    ) *
                    toNumber(
                        item.unitPrice
                    )
                ),
            0
        );


    const extraExpenses =
        calculatePurchaseExtraExpenses();


    const grandTotal =
        total +
        extraExpenses;


    const exchangeRate =
        toNumber(
            getValue(
                "purchaseExchangeRate"
            )
        ) || 1;


    const currency =
        getValue(
            "purchaseCurrency"
        ) ||
        "EGP";


    const purchase = {

        invoiceNumber:
            getValue(
                "purchaseInvoiceNumber"
            ),

        date:
            getValue(
                "purchaseDate"
            ) ||
            new Date()
                .toISOString()
                .split("T")[0],

        supplierId:
            getValue(
                "purchaseSupplier"
            ),

        supplierName:
            getSelectedSupplierName(),

        currency,

        exchangeRate,

        items:
            cart.map(
                item => ({

                    ...item,

                    unitPriceBase:
                        item.unitPrice *
                        exchangeRate,

                    totalBase:
                        item.total *
                        exchangeRate

                })
            ),

        total,

        totalBase:
            total *
            exchangeRate,

        extraExpenses: {

            shipping:
                toNumber(
                    getValue(
                        "purchaseShipping"
                    )
                ),

            customs:
                toNumber(
                    getValue(
                        "purchaseCustoms"
                    )
                ),

            clearance:
                toNumber(
                    getValue(
                        "purchaseClearance"
                    )
                ),

            transport:
                toNumber(
                    getValue(
                        "purchaseTransport"
                    )
                ),

            insurance:
                toNumber(
                    getValue(
                        "purchaseInsurance"
                    )
                ),

            other:
                toNumber(
                    getValue(
                        "purchaseOtherExpenses"
                    )
                )

        },

        extraExpensesTotal:
            extraExpenses,

        extraExpensesBase:
            extraExpenses *
            exchangeRate,

        grandTotal,

        grandTotalBase:
            grandTotal *
            exchangeRate,

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    try {

        const reference =
            await addDoc(
                collection(
                    db,
                    COLLECTIONS.purchases
                ),
                purchase
            );


        const savedPurchase = {

            id:
                reference.id,

            ...purchase

        };


        systemData.purchases.push(
            savedPurchase
        );


        /*
         * تحديث تكلفة المخزون
         *
         * المصروفات الإضافية لا تضاف بالكامل
         * لكل صنف.
         *
         * يتم توزيعها نسبيًا حسب قيمة كل صنف
         * من إجمالي الفاتورة.
         *
         * مثال:
         *
         * صنف A = 80%
         * صنف B = 20%
         *
         * مصروفات إضافية = 1000
         *
         * A يتحمل 800
         * B يتحمل 200
         *
         * ثم يتم حساب تكلفة الوحدة الجديدة
         * باستخدام متوسط التكلفة المرجح.
         */

        await updateInventoryAfterPurchase(
            cart,
            extraExpenses *
            exchangeRate
        );


        window.purchaseModalCart =
            [];


        closeModal();

        await loadAllData();

        showPage(
            "purchases"
        );


        showToast(
            "تم حفظ فاتورة الشراء وتحديث تكلفة المخزون",
            "success"
        );


    } catch (error) {

        console.error(
            "savePurchaseFromModal:",
            error
        );


        showToast(
            "تعذر حفظ فاتورة الشراء: " +
            (
                error.message ||
                "خطأ غير معروف"
            ),
            "error"
        );

    }

}


// =========================================================
// اسم المورد المختار
// =========================================================

function getSelectedSupplierName() {

    const id =
        getValue(
            "purchaseSupplier"
        );


    if (!id) return "";


    const supplier =
        systemData.suppliers.find(
            item =>
                item.id === id
        );


    return supplier
        ?
        supplier.name
        :
        "";

}


// =========================================================
// تحديث المخزون بعد الشراء
// =========================================================

async function updateInventoryAfterPurchase(
    cart,
    extraExpensesBase
) {

    const itemsValue =
        cart.reduce(
            (
                total,
                item
            ) =>
                total +
                (
                    toNumber(
                        item.quantity
                    ) *
                    toNumber(
                        item.unitPrice
                    )
                ),
            0
        );


    if (
        itemsValue <= 0
    ) return;


    for (
        const item of cart
    ) {

        const product =
            systemData.products.find(
                product =>
                    product.id ===
                    item.productId
            );


        if (!product) continue;


        const oldQuantity =
            toNumber(
                product.quantity
            );


        const oldCost =
            toNumber(
                product.buyPrice ??
                product.averageCost
            );


        const quantity =
            toNumber(
                item.quantity
            );


        const unitPriceBase =
            toNumber(
                item.unitPrice
            ) *
            toNumber(
                getValue(
                    "purchaseExchangeRate"
                )
            );


        /*
         * نسبة الصنف من قيمة البضاعة
         */

        const itemValue =
            quantity *
            toNumber(
                item.unitPrice
            );


        const share =
            itemValue /
            itemsValue;


        /*
         * نصيب الصنف من المصروفات الإضافية
         */

        const allocatedExpenses =
            extraExpensesBase *
            share;


        /*
         * المصروفات الإضافية لكل وحدة
         */

        const expensePerUnit =
            quantity > 0
            ?
            allocatedExpenses /
            quantity
            :
            0;


        /*
         * التكلفة الفعلية للوحدة في هذه الدفعة
         */

        const actualUnitCost =
            unitPriceBase +
            expensePerUnit;


        /*
         * المتوسط المرجح
         */

        const newQuantity =
            oldQuantity +
            quantity;


        const newAverageCost =
            newQuantity > 0
            ?
            (
                (
                    oldQuantity *
                    oldCost
                ) +
                (
                    quantity *
                    actualUnitCost
                )
            ) /
            newQuantity
            :
            actualUnitCost;


        const updates = {

            quantity:
                newQuantity,

            buyPrice:
                newAverageCost,

            averageCost:
                newAverageCost,

            lastPurchaseCost:
                actualUnitCost,

            lastPurchaseDate:
                getValue(
                    "purchaseDate"
                ),

            updatedAt:
                serverTimestamp()

        };


        await updateDoc(
            doc(
                db,
                COLLECTIONS.products,
                product.id
            ),
            updates
        );

    }

}


// =========================================================
// عرض فاتورة شراء
// =========================================================

function viewPurchase(
    id
) {

    const purchase =
        systemData.purchases.find(
            item =>
                item.id === id
        );


    if (!purchase) return;


    const items =
        Array.isArray(
            purchase.items
        )
        ?
        purchase.items
        :
        [];


    openModal(
        "تفاصيل فاتورة الشراء",
        `

        <div class="invoice-summary">

            <div class="summary-box">

                <span>
                    رقم الفاتورة
                </span>

                <strong>
                    ${escapeHtml(
                        purchase.invoiceNumber ||
                        purchase.id
                    )}
                </strong>

            </div>


            <div class="summary-box">

                <span>
                    المورد
                </span>

                <strong>
                    ${escapeHtml(
                        purchase.supplierName ||
                        "-"
                    )}
                </strong>

            </div>


            <div class="summary-box">

                <span>
                    إجمالي الأصناف
                </span>

                <strong>
                    ${formatMoney(
                        purchase.total
                    )}
                </strong>

            </div>


            <div class="summary-box">

                <span>
                    التكلفة الفعلية
                </span>

                <strong>
                    ${formatMoney(
                        purchase.grandTotal ??
                        purchase.total
                    )}
                </strong>

            </div>

        </div>


        <div class="table-wrapper">

            <table class="data-table">

                <thead>

                    <tr>

                        <th>الصنف</th>

                        <th>الكمية</th>

                        <th>سعر الوحدة</th>

                        <th>الإجمالي</th>

                    </tr>

                </thead>

                <tbody>

                    ${items.map(
                        item => `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    item.productName
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    item.quantity
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    item.unitPrice
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    item.total
                                )}
                            </td>

                        </tr>

                    `
                    ).join("")}

                </tbody>

            </table>

        </div>

        `,
        [
            {
                text: "إغلاق",
                className: "btn btn-light",
                action: closeModal
            }
        ],
        "modal-large"
    );

}


// =========================================================
// حذف فاتورة شراء
// =========================================================

async function deletePurchase(
    id
) {

    if (
        !confirm(
            "سيتم حذف الفاتورة وإرجاع كمياتها من المخزون (خصمها). ملاحظة: متوسط تكلفة الصنف لن يُعاد حسابه تلقائيًا. هل تريد المتابعة؟"
        )
    ) {

        return;

    }


    const purchase =
        systemData.purchases.find(
            item =>
                item.id === id
        );


    try {

        if (purchase) {

            await reverseInventoryForPurchase(
                purchase
            );

        }


        await deleteDoc(
            doc(
                db,
                COLLECTIONS.purchases,
                id
            )
        );


        systemData.purchases =
            systemData.purchases.filter(
                purchase =>
                    purchase.id !== id
            );


        refreshCurrentPage();

        showToast(
            "تم حذف الفاتورة وتحديث المخزون",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حذف الفاتورة",
            "error"
        );

    }

}


// -----------------------------------------
// إرجاع (خصم) الكميات اللي أُضيفت للمخزون
// عند إنشاء فاتورة شراء، وذلك عند حذفها
// -----------------------------------------

async function reverseInventoryForPurchase(
    purchase
) {

    const items =
        Array.isArray(purchase.items)
        ?
        purchase.items
        :
        [];

    for (
        const item of items
    ) {

        if (!item.productId) continue;

        const product =
            systemData.products.find(
                p =>
                    p.id === item.productId
            );

        if (!product) continue;

        const newQuantity =
            Math.max(
                0,
                toNumber(product.quantity) -
                toNumber(item.quantity)
            );

        await updateDoc(
            doc(
                db,
                COLLECTIONS.products,
                product.id
            ),
            {

                quantity:
                    newQuantity,

                updatedAt:
                    serverTimestamp()

            }
        );

        product.quantity =
            newQuantity;

    }

}


// =========================================================
// إنشاء فاتورة بيع
// =========================================================

function newSale() {

    window.saleModalCart =
        [];


    openModal(
        "فاتورة بيع جديدة",
        `
        <div>

            <div class="form-grid">

                <div class="form-group">

                    <label>رقم الفاتورة</label>

                    <input
                        id="saleInvoiceNumber"
                        class="form-control"
                        value="${generateInvoiceNumber(
                            "SAL"
                        )}">

                </div>


                <div class="form-group">

                    <label>التاريخ</label>

                    <input
                        id="saleDate"
                        type="date"
                        class="form-control"
                        value="${
                            new Date()
                                .toISOString()
                                .split("T")[0]
                        }">

                </div>


                <div class="form-group">

                    <label>العميل</label>

                    <div class="search-results">

                        <input
                            id="saleCustomerSearch"
                            class="form-control"
                            placeholder="ابحث عن العميل..."
                            oninput="searchSaleCustomers(this.value)">

                        <input
                            id="saleCustomer"
                            type="hidden">

                        <div
                            id="saleCustomerResults"
                            class="search-results-list">
                        </div>

                    </div>

                </div>

            </div>


            <hr>


            <div class="form-grid">

                <div class="form-group">

                    <label>الصنف</label>

                    <div class="search-results">

                        <input
                            id="saleProductSearch"
                            class="form-control"
                            placeholder="ابحث عن الصنف..."
                            oninput="searchSaleProducts(this.value)">

                        <input
                            id="saleProduct"
                            type="hidden">

                        <div
                            id="saleProductResults"
                            class="search-results-list">
                        </div>

                    </div>

                </div>


                <div class="form-group">

                    <label>الكمية</label>

                    <input
                        id="saleQuantity"
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value="1"
                        class="form-control">

                </div>


                <div class="form-group">

                    <label>سعر البيع</label>

                    <input
                        id="saleUnitPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value="0"
                        class="form-control">

                </div>

            </div>


            <button
                type="button"
                class="btn btn-primary"
                onclick="addSaleItem()">

                + إضافة للصورة

            </button>


            <div
                id="saleCart"
                class="cart-table">

                <div class="empty-state">
                    لم تتم إضافة أصناف
                </div>

            </div>


            <div class="form-grid">

                <div class="form-group">

                    <label>المدفوع</label>

                    <input
                        id="salePaid"
                        type="number"
                        min="0"
                        step="0.01"
                        value="0"
                        class="form-control"
                        oninput="updateSaleTotals()">

                </div>

            </div>


            <div class="invoice-summary">

                <div class="summary-box">

                    <span>
                        الإجمالي
                    </span>

                    <strong id="saleTotal">
                        0
                    </strong>

                </div>


                <div class="summary-box">

                    <span>
                        المدفوع
                    </span>

                    <strong id="salePaidSummary">
                        0
                    </strong>

                </div>


                <div class="summary-box">

                    <span>
                        المتبقي
                    </span>

                    <strong id="saleRemaining">
                        0
                    </strong>

                </div>

            </div>

        </div>
        `,
        [
            {
                text: "إلغاء",
                className: "btn btn-light",
                action: closeModal
            },
            {
                text: "حفظ الفاتورة",
                className: "btn btn-primary",
                action: saveSaleFromModal
            }
        ],
        "modal-large"
    );

}


// =========================================================
// البحث عن العملاء في البيع
// =========================================================

function searchSaleCustomers(
    text
) {

    const container =
        document.getElementById(
            "saleCustomerResults"
        );


    if (!container) return;


    const value =
        normalizeSearchText(
            text
        );


    if (!value) {

        container.innerHTML = "";

        return;

    }


    const customers =
        systemData.customers.filter(
            customer =>
                matchesSearch(
                    [
                        customer.name,
                        customer.phone,
                        customer.address
                    ],
                    value
                )
        );


    container.innerHTML =
        customers
            .slice(
                0,
                10
            )
            .map(
                customer => `

                <div
                    class="search-result-item"
                    onclick="selectSaleCustomer('${customer.id}')">

                    <strong>
                        ${escapeHtml(
                            customer.name
                        )}
                    </strong>

                    <small>
                        ${escapeHtml(
                            customer.phone ||
                            ""
                        )}
                    </small>

                </div>

            `
            )
            .join("");

}


// =========================================================
// اختيار العميل
// =========================================================

function selectSaleCustomer(
    id
) {

    const customer =
        systemData.customers.find(
            item =>
                item.id === id
        );


    if (!customer) return;


    setInputValue(
        "saleCustomer",
        customer.id
    );


    setInputValue(
        "saleCustomerSearch",
        customer.name
    );


    const results =
        document.getElementById(
            "saleCustomerResults"
        );


    if (results) {

        results.innerHTML = "";

    }

}


// =========================================================
// البحث عن صنف للبيع
// =========================================================

function searchSaleProducts(
    text
) {

    const container =
        document.getElementById(
            "saleProductResults"
        );


    if (!container) return;


    const value =
        normalizeSearchText(
            text
        );


    if (!value) {

        container.innerHTML = "";

        return;

    }


    const products =
        systemData.products.filter(
            product =>
                matchesSearch(
                    [
                        product.name,
                        product.code,
                        product.barcode,
                        product.category
                    ],
                    value
                )
        );


    container.innerHTML =
        products
            .slice(
                0,
                15
            )
            .map(
                product => `

                <div
                    class="search-result-item"
                    onclick="selectSaleProduct('${product.id}')">

                    <strong>
                        ${escapeHtml(
                            product.name
                        )}
                    </strong>

                    <small>
                        المتاح:
                        ${formatNumber(
                            product.quantity
                        )}
                        |
                        السعر:
                        ${formatMoney(
                            product.sellPrice
                        )}
                    </small>

                </div>

            `
            )
            .join("");

}


// =========================================================
// اختيار صنف البيع
// =========================================================

function selectSaleProduct(
    id
) {

    const product =
        systemData.products.find(
            item =>
                item.id === id
        );


    if (!product) return;


    setInputValue(
        "saleProduct",
        product.id
    );


    setInputValue(
        "saleProductSearch",
        product.name
    );


    setInputValue(
        "saleUnitPrice",
        toNumber(
            product.sellPrice
        )
    );


    const results =
        document.getElementById(
            "saleProductResults"
        );


    if (results) {

        results.innerHTML = "";

    }

}


// =========================================================
// إضافة صنف للبيع
// =========================================================

function addSaleItem() {

    const productId =
        getValue(
            "saleProduct"
        );


    const product =
        systemData.products.find(
            item =>
                item.id === productId
        );


    if (!product) {

        showToast(
            "اختر صنفًا",
            "warning"
        );

        return;

    }


    const quantity =
        toNumber(
            getValue(
                "saleQuantity"
            )
        );


    const unitPrice =
        toNumber(
            getValue(
                "saleUnitPrice"
            )
        );


    if (
        quantity <= 0 ||
        unitPrice < 0
    ) {

        showToast(
            "راجع الكمية والسعر",
            "warning"
        );

        return;

    }


    const alreadyInCart =
        (
            window.saleModalCart ||
            []
        )
            .filter(
                item =>
                    item.productId === productId
            )
            .reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    toNumber(
                        item.quantity
                    ),
                0
            );


    const available =
        toNumber(
            product.quantity
        ) -
        alreadyInCart;


    if (
        quantity >
        available
    ) {

        showToast(
            available > 0
            ?
            `الكمية المطلوبة أكبر من المخزون المتاح (المتبقي: ${available})`
            :
            "لا يوجد مخزون متاح لهذا الصنف (تمت إضافة كل الكمية المتوفرة للسلة بالفعل)",
            "warning"
        );

        return;

    }


    if (
        !window.saleModalCart
    ) {

        window.saleModalCart =
            [];

    }


    window.saleModalCart.push({

        productId,

        productName:
            product.name,

        quantity,

        unitPrice,

        cost:
            toNumber(
                product.buyPrice ??
                product.averageCost
            ),

        total:
            quantity *
            unitPrice

    });


    renderSaleCart();

    updateSaleTotals();


    setInputValue(
        "saleProduct",
        ""
    );


    setInputValue(
        "saleProductSearch",
        ""
    );


    setInputValue(
        "saleQuantity",
        "1"
    );


    setInputValue(
        "saleUnitPrice",
        "0"
    );

}


// =========================================================
// عرض سلة البيع
// =========================================================

function renderSaleCart() {

    const container =
        document.getElementById(
            "saleCart"
        );


    if (!container) return;


    const cart =
        window.saleModalCart ||
        [];


    if (!cart.length) {

        container.innerHTML =
            `<div class="empty-state">
                لم تتم إضافة أصناف
            </div>`;

        return;

    }


    container.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>الصنف</th>

                    <th>الكمية</th>

                    <th>السعر</th>

                    <th>الإجمالي</th>

                    <th>الإجراء</th>

                </tr>

            </thead>

            <tbody>

                ${cart.map(
                    (
                        item,
                        index
                    ) => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                item.productName
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                item.quantity
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                item.unitPrice
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                item.total
                            )}
                        </td>

                        <td>

                            <button
                                class="btn btn-danger btn-sm"
                                onclick="removeSaleItem(${index})">

                                حذف

                            </button>

                        </td>

                    </tr>

                `
                ).join("")}

            </tbody>

        </table>

    `;

}


// =========================================================
// حذف صنف بيع
// =========================================================

function removeSaleItem(
    index
) {

    if (
        !window.saleModalCart
    ) return;


    window.saleModalCart.splice(
        index,
        1
    );


    renderSaleCart();

    updateSaleTotals();

}


// =========================================================
// إجماليات البيع
// =========================================================

function updateSaleTotals() {

    const cart =
        window.saleModalCart ||
        [];


    const total =
        cart.reduce(
            (
                sum,
                item
            ) =>
                sum +
                toNumber(
                    item.total
                ),
            0
        );


    const paid =
        toNumber(
            getValue(
                "salePaid"
            )
        );


    const remaining =
        total -
        paid;


    setText(
        "saleTotal",
        formatMoney(total)
    );


    setText(
        "salePaidSummary",
        formatMoney(paid)
    );


    setText(
        "saleRemaining",
        formatMoney(remaining)
    );

}


// =========================================================
// حفظ البيع
// =========================================================

async function saveSaleFromModal() {

    const cart =
        window.saleModalCart ||
        [];


    if (!cart.length) {

        showToast(
            "أضف صنفًا واحدًا على الأقل",
            "warning"
        );

        return;

    }


    // -----------------------------------------
    // تحقق نهائي من توفر المخزون قبل الحفظ
    // (يحمي من بيع كمية أكبر من المتاح إذا
    // تغيّر المخزون أثناء فتح الفاتورة)
    // -----------------------------------------

    const neededPerProduct = {};

    for (
        const item of cart
    ) {

        neededPerProduct[item.productId] =
            (
                neededPerProduct[item.productId] ||
                0
            ) +
            toNumber(
                item.quantity
            );

    }

    for (
        const productId in neededPerProduct
    ) {

        const product =
            systemData.products.find(
                item =>
                    item.id === productId
            );

        const available =
            toNumber(
                product
                ?
                product.quantity
                :
                0
            );

        if (
            neededPerProduct[productId] >
            available
        ) {

            showToast(
                `الكمية المطلوبة من "${product ? product.name : productId}" أكبر من المخزون المتاح حاليًا (${available}). حدّث الفاتورة وحاول مجددًا.`,
                "error"
            );

            return;

        }

    }


    const total =
        cart.reduce(
            (
                sum,
                item
            ) =>
                sum +
                toNumber(
                    item.total
                ),
            0
        );


    const paid =
        toNumber(
            getValue(
                "salePaid"
            )
        );


    if (
        paid > total
    ) {

        showToast(
            "المبلغ المدفوع أكبر من إجمالي الفاتورة",
            "warning"
        );

        return;

    }


    const customerId =
        getValue(
            "saleCustomer"
        );


    const customer =
        systemData.customers.find(
            item =>
                item.id === customerId
        );


    const sale = {

        invoiceNumber:
            getValue(
                "saleInvoiceNumber"
            ),

        date:
            getValue(
                "saleDate"
            ) ||
            new Date()
                .toISOString()
                .split("T")[0],

        customerId,

        customerName:
            customer
            ?
            customer.name
            :
            "نقدي",

        items:
            cart,

        total,

        paid,

        remaining:
            total -
            paid,

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    try {

        const reference =
            await addDoc(
                collection(
                    db,
                    COLLECTIONS.sales
                ),
                sale
            );


        for (
            const item of cart
        ) {

            const product =
                systemData.products.find(
                    product =>
                        product.id ===
                        item.productId
                );


            if (!product) continue;


            const newQuantity =
                Math.max(
                    0,
                    toNumber(
                        product.quantity
                    ) -
                    toNumber(
                        item.quantity
                    )
                );


            await updateDoc(
                doc(
                    db,
                    COLLECTIONS.products,
                    product.id
                ),
                {

                    quantity:
                        newQuantity,

                    updatedAt:
                        serverTimestamp()

                }
            );

        }


        systemData.sales.push({

            id:
                reference.id,

            ...sale

        });


        window.saleModalCart =
            [];


        closeModal();

        await loadAllData();

        showPage(
            "sales"
        );


        showToast(
            "تم حفظ فاتورة البيع وتحديث المخزون",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حفظ فاتورة البيع: " +
            (
                error.message ||
                "خطأ غير معروف"
            ),
            "error"
        );

    }

}


// =========================================================
// عرض فاتورة بيع
// =========================================================

function viewSale(
    id
) {

    const sale =
        systemData.sales.find(
            item =>
                item.id === id
        );


    if (!sale) return;


    const items =
        Array.isArray(
            sale.items
        )
        ?
        sale.items
        :
        [];


    openModal(
        "تفاصيل فاتورة البيع",
        `

        <div class="invoice-summary">

            <div class="summary-box">

                <span>
                    رقم الفاتورة
                </span>

                <strong>
                    ${escapeHtml(
                        sale.invoiceNumber ||
                        sale.id
                    )}
                </strong>

            </div>


            <div class="summary-box">

                <span>
                    العميل
                </span>

                <strong>
                    ${escapeHtml(
                        sale.customerName ||
                        "نقدي"
                    )}
                </strong>

            </div>


            <div class="summary-box">

                <span>
                    الإجمالي
                </span>

                <strong>
                    ${formatMoney(
                        sale.total
                    )}
                </strong>

            </div>


            <div class="summary-box">

                <span>
                    المتبقي
                </span>

                <strong>
                    ${formatMoney(
                        sale.remaining
                    )}
                </strong>

            </div>

        </div>


        <div class="table-wrapper">

            <table class="data-table">

                <thead>

                    <tr>

                        <th>الصنف</th>

                        <th>الكمية</th>

                        <th>السعر</th>

                        <th>الإجمالي</th>

                    </tr>

                </thead>

                <tbody>

                    ${items.map(
                        item => `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    item.productName
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    item.quantity
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    item.unitPrice
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    item.total
                                )}
                            </td>

                        </tr>

                    `
                    ).join("")}

                </tbody>

            </table>

        </div>

        `,
        [
            {
                text: "إغلاق",
                className: "btn btn-light",
                action: closeModal
            }
        ],
        "modal-large"
    );

}


// =========================================================
// حذف البيع
// =========================================================

async function deleteSale(
    id
) {

    if (
        !confirm(
            "سيتم حذف فاتورة البيع وإرجاع كمياتها للمخزون. هل تريد المتابعة؟"
        )
    ) {

        return;

    }


    const sale =
        systemData.sales.find(
            item =>
                item.id === id
        );


    try {

        if (sale) {

            await reverseInventoryForSale(
                sale
            );

        }


        await deleteDoc(
            doc(
                db,
                COLLECTIONS.sales,
                id
            )
        );


        systemData.sales =
            systemData.sales.filter(
                sale =>
                    sale.id !== id
            );


        refreshCurrentPage();

        showToast(
            "تم حذف الفاتورة وإرجاع الكميات للمخزون",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "تعذر حذف الفاتورة",
            "error"
        );

    }

}


// -----------------------------------------
// إرجاع الكميات اللي اتخصمت من المخزون عند
// إنشاء فاتورة بيع، وذلك عند حذفها
// -----------------------------------------

async function reverseInventoryForSale(
    sale
) {

    const items =
        Array.isArray(sale.items)
        ?
        sale.items
        :
        [];

    for (
        const item of items
    ) {

        if (!item.productId) continue;

        const product =
            systemData.products.find(
                p =>
                    p.id === item.productId
            );

        if (!product) continue;

        const newQuantity =
            toNumber(product.quantity) +
            toNumber(item.quantity);

        await updateDoc(
            doc(
                db,
                COLLECTIONS.products,
                product.id
            ),
            {

                quantity:
                    newQuantity,

                updatedAt:
                    serverTimestamp()

            }
        );

        product.quantity =
            newQuantity;

    }

}


// =========================================================
// أدوات مشتركة للتقارير والتحليل
// =========================================================

function sumBy(
    list,
    valueFn
) {

    return (list || []).reduce(
        (
            total,
            item
        ) =>
            total +
            toNumber(
                valueFn(item)
            ),
        0
    );

}


function filterByDateRange(
    records,
    from,
    to
) {

    return (records || []).filter(
        record => {

            const date =
                getRecordDate(
                    record
                );

            if (!date) return false;

            if (from && date < from) return false;

            if (to && date > to) return false;

            return true;

        }
    );

}


function calcSalesTotal(sales) {

    return sumBy(
        sales,
        sale => sale.total
    );

}


function calcCostOfSales(sales) {

    return sumBy(
        sales,
        sale =>
            (
                Array.isArray(sale.items)
                ?
                sale.items
                :
                []
            ).reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    (
                        toNumber(item.quantity) *
                        toNumber(item.cost ?? item.buyPrice)
                    ),
                0
            )
    );

}


function calcPurchasesTotal(purchases) {

    return sumBy(
        purchases,
        purchase =>
            purchase.grandTotal ??
            purchase.total
    );

}


function calcExpensesTotal(expenses) {

    return sumBy(
        expenses,
        expense => expense.amount
    );

}


// -----------------------------------------
// نسبة النمو مقارنة بفترة سابقة
// -----------------------------------------

function growthBadgeHtml(
    current,
    previous
) {

    if (!previous) {

        if (!current) {

            return `<span class="badge growth-badge">لا تغيير</span>`;

        }

        return `<span class="badge badge-success growth-badge">▲ جديد</span>`;

    }


    const percent =
        (
            (current - previous) /
            Math.abs(previous)
        ) * 100;

    const isUp =
        percent >= 0;

    return `
        <span class="badge ${isUp ? "badge-success" : "badge-danger"} growth-badge">
            ${isUp ? "▲" : "▼"}
            ${Math.abs(percent).toFixed(1)}%
        </span>
    `;

}


// -----------------------------------------
// نطاق الفترة السابقة (بنفس طول الفترة الحالية)
// -----------------------------------------

function getPreviousRange(
    from,
    to
) {

    const fromDate =
        new Date(from);

    const toDate =
        new Date(to);

    const lengthMs =
        toDate.getTime() -
        fromDate.getTime();

    const prevTo =
        new Date(
            fromDate.getTime() -
            86400000
        );

    const prevFrom =
        new Date(
            prevTo.getTime() -
            lengthMs
        );

    return {

        from:
            prevFrom.toISOString().split("T")[0],

        to:
            prevTo.toISOString().split("T")[0]

    };

}


// -----------------------------------------
// أفضل المنتجات مبيعًا (كمية / إيراد / ربح)
// -----------------------------------------

function topProductsFromSales(
    sales,
    topN = 5,
    sortKey = "revenue"
) {

    const map = {};

    (sales || []).forEach(
        sale => {

            (
                Array.isArray(sale.items)
                ?
                sale.items
                :
                []
            ).forEach(
                item => {

                    const key =
                        item.productId ||
                        item.productName;

                    if (!key) return;

                    if (!map[key]) {

                        map[key] = {

                            name:
                                item.productName ||
                                "-",

                            qty: 0,

                            revenue: 0,

                            cost: 0

                        };

                    }


                    map[key].qty +=
                        toNumber(
                            item.quantity
                        );

                    map[key].revenue +=
                        toNumber(
                            item.total ??
                            (
                                toNumber(item.quantity) *
                                toNumber(item.unitPrice)
                            )
                        );

                    map[key].cost +=
                        toNumber(item.quantity) *
                        toNumber(item.cost ?? item.buyPrice);

                }
            );

        }
    );


    return Object.values(map)
        .map(
            product => ({

                ...product,

                profit:
                    product.revenue -
                    product.cost

            })
        )
        .sort(
            (a, b) =>
                b[sortKey] -
                a[sortKey]
        )
        .slice(0, topN);

}


// -----------------------------------------
// أفضل العملاء (حسب إجمالي مبيعاتهم)
// -----------------------------------------

function topCustomersFromSales(
    sales,
    topN = 5
) {

    const map = {};

    (sales || []).forEach(
        sale => {

            const key =
                sale.customerId ||
                sale.customerName ||
                "نقدي";

            if (!map[key]) {

                map[key] = {

                    name:
                        sale.customerName ||
                        "نقدي",

                    invoices: 0,

                    total: 0

                };

            }


            map[key].invoices += 1;

            map[key].total +=
                toNumber(
                    sale.total
                );

        }
    );


    return Object.values(map)
        .sort(
            (a, b) =>
                b.total -
                a.total
        )
        .slice(0, topN);

}


// -----------------------------------------
// المصروفات حسب النوع
// -----------------------------------------

function expensesByCategory(
    expenses
) {

    const map = {};

    const grandTotal =
        calcExpensesTotal(
            expenses
        );

    (expenses || []).forEach(
        expense => {

            const key =
                expense.category ||
                "غير مصنف";

            map[key] =
                (map[key] || 0) +
                toNumber(
                    expense.amount
                );

        }
    );


    return Object.entries(map)
        .map(
            ([category, total]) => ({

                category,

                total,

                percent:
                    grandTotal > 0
                    ?
                    (total / grandTotal * 100)
                    :
                    0

            })
        )
        .sort(
            (a, b) =>
                b.total -
                a.total
        );

}


// -----------------------------------------
// أكبر مديونيات العملاء (كل الفواتير، بغض
// النظر عن فترة التقرير - لأنها حالة حالية)
// -----------------------------------------

function topDebtors(
    topN = 5
) {

    const map = {};

    systemData.sales.forEach(
        sale => {

            const remaining =
                toNumber(
                    sale.remaining
                );

            if (remaining <= 0) return;


            const key =
                sale.customerId ||
                sale.customerName ||
                "نقدي";

            if (!map[key]) {

                map[key] = {

                    name:
                        sale.customerName ||
                        "نقدي",

                    remaining: 0,

                    invoices: 0

                };

            }


            map[key].remaining +=
                remaining;

            map[key].invoices += 1;

        }
    );


    return Object.values(map)
        .sort(
            (a, b) =>
                b.remaining -
                a.remaining
        )
        .slice(0, topN);

}


// -----------------------------------------
// تجميع المبيعات عبر الزمن (يوم/أسبوع/شهر
// حسب طول الفترة) لعرضها كمخطط أعمدة
// -----------------------------------------

function buildSalesTimeSeries(
    sales,
    from,
    to
) {

    const spanDays =
        Math.max(
            1,
            Math.round(
                (
                    new Date(to) -
                    new Date(from)
                ) /
                86400000
            ) + 1
        );

    const granularity =
        spanDays > 90
        ?
        "month"
        :
        spanDays > 31
        ?
        "week"
        :
        "day";


    const bucketKey = date => {

        if (granularity === "day") return date;

        if (granularity === "month") return date.slice(0, 7);


        const d = new Date(date);

        const weekStart =
            new Date(d);

        weekStart.setDate(
            d.getDate() -
            d.getDay()
        );

        return weekStart
            .toISOString()
            .split("T")[0];

    };


    const map = {};

    sales.forEach(
        sale => {

            const date =
                getRecordDate(sale);

            if (!date) return;

            const key =
                bucketKey(date);

            map[key] =
                (map[key] || 0) +
                toNumber(sale.total);

        }
    );


    const points =
        Object.keys(map)
            .sort()
            .map(
                key => ({
                    label: key,
                    total: map[key]
                })
            );


    return {
        granularity,
        points
    };

}


function formatBucketLabel(
    key,
    granularity
) {

    if (granularity === "month") {

        const date =
            new Date(key + "-01");

        return date.toLocaleDateString(
            "ar-EG",
            {
                month: "short",
                year: "2-digit"
            }
        );

    }


    if (granularity === "week") {

        return "أسبوع " +
            key.slice(5);

    }


    return key.slice(5);

}


function renderBarChartHtml(
    points,
    granularity
) {

    if (!points.length) {

        return `<div class="empty-state">لا توجد بيانات مبيعات بهذه الفترة</div>`;

    }


    const max =
        Math.max(
            ...points.map(p => p.total),
            1
        );


    const bars =
        points.map(
            point => `

            <div class="bar-col">

                <span class="bar-value">
                    ${formatMoney(point.total)}
                </span>

                <div
                    class="bar"
                    style="height:${Math.max(4, Math.round(point.total / max * 100))}%">
                </div>

                <span class="bar-label">
                    ${formatBucketLabel(point.label, granularity)}
                </span>

            </div>

        `
        ).join("");


    return `<div class="bar-chart">${bars}</div>`;

}


// -----------------------------------------
// ربحية كل عميل (كامل، بدون تحديد عدد)
// -----------------------------------------

function customerProfitability(
    sales
) {

    const map = {};

    (sales || []).forEach(
        sale => {

            const key =
                sale.customerId ||
                sale.customerName ||
                "نقدي";

            if (!map[key]) {

                map[key] = {

                    name:
                        sale.customerName ||
                        "نقدي",

                    invoices: 0,

                    revenue: 0,

                    cost: 0

                };

            }


            map[key].invoices += 1;

            map[key].revenue +=
                toNumber(
                    sale.total
                );

            map[key].cost +=
                (
                    Array.isArray(sale.items)
                    ?
                    sale.items
                    :
                    []
                ).reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        (
                            toNumber(item.quantity) *
                            toNumber(item.cost ?? item.buyPrice)
                        ),
                    0
                );

        }
    );


    const outstandingMap = {};

    systemData.sales.forEach(
        sale => {

            const remaining =
                toNumber(
                    sale.remaining
                );

            if (remaining <= 0) return;

            const key =
                sale.customerId ||
                sale.customerName ||
                "نقدي";

            outstandingMap[key] =
                (outstandingMap[key] || 0) +
                remaining;

        }
    );


    return Object.entries(map)
        .map(
            ([key, row]) => {

                const profit =
                    row.revenue -
                    row.cost;

                return {

                    ...row,

                    profit,

                    margin:
                        row.revenue > 0
                        ?
                        (profit / row.revenue * 100)
                        :
                        0,

                    avgOrderValue:
                        row.invoices > 0
                        ?
                        (row.revenue / row.invoices)
                        :
                        0,

                    outstanding:
                        outstandingMap[key] || 0

                };

            }
        )
        .sort(
            (a, b) =>
                b.profit -
                a.profit
        );

}


// -----------------------------------------
// أداء الموردين (كامل)
// -----------------------------------------

function supplierPerformance(
    purchases
) {

    const map = {};

    (purchases || []).forEach(
        purchase => {

            const key =
                purchase.supplierId ||
                purchase.supplierName ||
                "غير محدد";

            if (!map[key]) {

                map[key] = {

                    name:
                        purchase.supplierName ||
                        "غير محدد",

                    invoices: 0,

                    total: 0

                };

            }


            map[key].invoices += 1;

            map[key].total +=
                toNumber(
                    purchase.totalBase ??
                    purchase.total
                );

        }
    );


    return Object.entries(map)
        .map(
            ([key, row]) => {

                const supplier =
                    systemData.suppliers.find(
                        item =>
                            item.id === key ||
                            item.name === row.name
                    );

                return {

                    ...row,

                    balance:
                        supplier
                        ?
                        toNumber(supplier.balance)
                        :
                        0

                };

            }
        )
        .sort(
            (a, b) =>
                b.total -
                a.total
        );

}


// -----------------------------------------
// تكلفة الرواتب (العمال)
// -----------------------------------------

function payrollSummary() {

    const employees =
        systemData.employees ||
        [];

    const total =
        sumBy(
            employees,
            employee => employee.salary
        );

    return {
        employees,
        total
    };

}


// -----------------------------------------
// توزيع أرباح المستثمرين حسب نسبة رأس المال
// -----------------------------------------

function investorsDistribution(
    netProfit
) {

    const investors =
        systemData.investors ||
        [];

    const totalCapital =
        sumBy(
            investors,
            investor => investor.capital
        );

    if (!investors.length || totalCapital <= 0) {

        return {
            rows: [],
            totalCapital
        };

    }


    const rows =
        investors.map(
            investor => {

                const capital =
                    toNumber(
                        investor.capital
                    );

                const percent =
                    capital /
                    totalCapital *
                    100;

                return {

                    name:
                        investor.name,

                    capital,

                    percent,

                    share:
                        netProfit *
                        (percent / 100)

                };

            }
        );


    return {
        rows,
        totalCapital
    };

}


// -----------------------------------------
// التدفق النقدي التقديري للفترة
// (نقد فعلي داخل من المبيعات المحصّلة، ونقد
// خارج للمشتريات والمصروفات - على افتراض
// أن المشتريات والمصروفات تُدفع نقدًا بالكامل
// وقت تسجيلها، وأن المبيعات تُحصَّل بقيمة
// حقل "المدفوع" وقت إنشاء الفاتورة فقط)
// -----------------------------------------

function calculateCashFlow(
    sales,
    purchases,
    expenses
) {

    const cashInFromSales =
        sumBy(
            sales,
            sale => sale.paid
        );

    const cashOutPurchases =
        sumBy(
            purchases,
            purchase =>
                purchase.totalBase ??
                purchase.total
        );

    const cashOutExpenses =
        calcExpensesTotal(
            expenses
        );

    const cashOut =
        cashOutPurchases +
        cashOutExpenses;

    return {

        cashIn:
            cashInFromSales,

        cashOutPurchases,

        cashOutExpenses,

        cashOut,

        net:
            cashInFromSales -
            cashOut

    };

}


// -----------------------------------------
// الأصناف الراكدة (ما بيعت خلال آخر N يوم
// وعندها مخزون حالي)
// -----------------------------------------

function detectSlowMovingProducts(
    days = 60
) {

    const cutoff =
        new Date();

    cutoff.setDate(
        cutoff.getDate() -
        days
    );

    const cutoffStr =
        cutoff.toISOString().split("T")[0];


    const lastSaleDate = {};

    systemData.sales.forEach(
        sale => {

            const date =
                getRecordDate(sale);

            if (!date) return;

            (
                Array.isArray(sale.items)
                ?
                sale.items
                :
                []
            ).forEach(
                item => {

                    const key =
                        item.productId;

                    if (!key) return;

                    if (
                        !lastSaleDate[key] ||
                        date > lastSaleDate[key]
                    ) {

                        lastSaleDate[key] =
                            date;

                    }

                }
            );

        }
    );


    return systemData.products
        .filter(
            product =>
                toNumber(product.quantity) > 0
        )
        .map(
            product => ({

                name:
                    product.name,

                quantity:
                    toNumber(product.quantity),

                lastSaleDate:
                    lastSaleDate[product.id] ||
                    null

            })
        )
        .filter(
            product =>
                !product.lastSaleDate ||
                product.lastSaleDate < cutoffStr
        )
        .sort(
            (a, b) =>
                b.quantity -
                a.quantity
        );

}


// -----------------------------------------
// أصناف بمخزون أقل من الحد الأدنى
// -----------------------------------------

function detectLowStockProducts() {

    return systemData.products
        .filter(
            product =>
                toNumber(product.minStock) > 0 &&
                toNumber(product.quantity) <=
                toNumber(product.minStock)
        )
        .sort(
            (a, b) =>
                toNumber(a.quantity) -
                toNumber(b.quantity)
        );

}


// -----------------------------------------
// الأصناف الأكثر نموًا/تراجعًا (مقارنة كمية
// المبيعات بين الفترة الحالية والسابقة)
// -----------------------------------------

function detectTrendingProducts(
    currentSales,
    previousSales
) {

    const current =
        topProductsFromSales(
            currentSales,
            999999,
            "qty"
        );

    const previousMap = {};

    topProductsFromSales(
        previousSales,
        999999,
        "qty"
    ).forEach(
        product => {

            previousMap[product.name] =
                product.qty;

        }
    );


    const withChange =
        current.map(
            product => {

                const previousQty =
                    previousMap[product.name] ||
                    0;

                const change =
                    previousQty > 0
                    ?
                    (
                        (product.qty - previousQty) /
                        previousQty *
                        100
                    )
                    :
                    (
                        product.qty > 0
                        ?
                        100
                        :
                        0
                    );

                return {

                    ...product,

                    previousQty,

                    change

                };

            }
        );


    return {

        growing:
            withChange
                .filter(p => p.change > 15)
                .sort((a, b) => b.change - a.change)
                .slice(0, 5),

        declining:
            withChange
                .filter(p => p.change < -15)
                .sort((a, b) => a.change - b.change)
                .slice(0, 5)

    };

}


// -----------------------------------------
// توقع تقديري لمبيعات الفترة القادمة
// (بناءً على متوسط نمو آخر 3 أشهر فعليًا -
// تقدير تقريبي وليس ضمانًا)
// -----------------------------------------

function forecastNextPeriodRevenue() {

    const monthMap = {};

    systemData.sales.forEach(
        sale => {

            const date =
                getRecordDate(sale);

            if (!date) return;

            const key =
                date.slice(0, 7);

            monthMap[key] =
                (monthMap[key] || 0) +
                toNumber(sale.total);

        }
    );


    const months =
        Object.keys(monthMap)
            .sort();

    if (months.length < 2) {

        return null;

    }


    const lastMonths =
        months.slice(-4);

    const values =
        lastMonths.map(
            month => monthMap[month]
        );

    const growthRates = [];

    for (
        let index = 1;
        index < values.length;
        index++
    ) {

        const previous =
            values[index - 1];

        if (previous > 0) {

            growthRates.push(
                (values[index] - previous) /
                previous
            );

        }

    }


    if (!growthRates.length) {

        return null;

    }


    const avgGrowth =
        growthRates.reduce(
            (a, b) => a + b,
            0
        ) /
        growthRates.length;

    const lastValue =
        values[values.length - 1];

    const forecast =
        Math.max(
            0,
            lastValue *
            (1 + avgGrowth)
        );

    return {

        lastMonth:
            lastMonths[lastMonths.length - 1],

        lastValue,

        avgGrowth:
            avgGrowth * 100,

        forecast

    };

}


// =========================================================
// تصدير التقرير لملف Excel
// =========================================================

function exportReportsToExcel() {

    const data =
        window.lastReportData;

    if (!data) {

        showToast(
            "أنشئ التقرير أولًا (اضغط \"إنشاء التقرير\")",
            "warning"
        );

        return;

    }

    if (
        typeof XLSX === "undefined"
    ) {

        showToast(
            "تعذر تحميل مكتبة تصدير Excel. تأكد من الاتصال بالإنترنت.",
            "error"
        );

        return;

    }


    const workbook =
        XLSX.utils.book_new();


    const summarySheet =
        XLSX.utils.aoa_to_sheet([

            ["ملخص التقرير", ""],
            ["من", data.from],
            ["إلى", data.to],
            ["", ""],
            ["إجمالي المبيعات", data.salesTotal],
            ["إجمالي المشتريات", data.purchasesTotal],
            ["إجمالي المصروفات", data.expensesTotal],
            ["تكلفة البضاعة المباعة", data.costOfSales],
            ["مجمل الربح", data.grossProfit],
            ["صافي الربح", data.netProfit],
            ["هامش الربح %", data.margin]

        ]);

    XLSX.utils.book_append_sheet(
        workbook,
        summarySheet,
        "ملخص"
    );


    const productsSheet =
        XLSX.utils.json_to_sheet(
            data.allProducts.map(
                product => ({

                    "الصنف": product.name,
                    "الكمية": product.qty,
                    "الإيراد": product.revenue,
                    "التكلفة": product.cost,
                    "الربح": product.profit,
                    "هامش %":
                        product.revenue > 0
                        ?
                        Number((product.profit / product.revenue * 100).toFixed(1))
                        :
                        0

                })
            )
        );

    XLSX.utils.book_append_sheet(
        workbook,
        productsSheet,
        "ربحية الأصناف"
    );


    const customersSheet =
        XLSX.utils.json_to_sheet(
            data.allCustomers.map(
                customer => ({

                    "العميل": customer.name,
                    "عدد الفواتير": customer.invoices,
                    "الإيراد": customer.revenue,
                    "الربح": customer.profit,
                    "هامش %": Number(customer.margin.toFixed(1)),
                    "متوسط الفاتورة": Number(customer.avgOrderValue.toFixed(2)),
                    "المتبقي حاليًا": customer.outstanding

                })
            )
        );

    XLSX.utils.book_append_sheet(
        workbook,
        customersSheet,
        "ربحية العملاء"
    );


    const suppliersSheet =
        XLSX.utils.json_to_sheet(
            data.suppliersPerf.map(
                supplier => ({

                    "المورد": supplier.name,
                    "عدد الفواتير": supplier.invoices,
                    "إجمالي المشتريات": supplier.total,
                    "المستحق له": supplier.balance

                })
            )
        );

    XLSX.utils.book_append_sheet(
        workbook,
        suppliersSheet,
        "أداء الموردين"
    );


    const payrollSheet =
        XLSX.utils.json_to_sheet(
            data.payroll.employees.map(
                employee => ({

                    "الاسم": employee.name || "-",
                    "الوظيفة": employee.job || "-",
                    "نوع الراتب": employee.salaryType || "-",
                    "الراتب": employee.salary

                })
            )
        );

    XLSX.utils.book_append_sheet(
        workbook,
        payrollSheet,
        "الرواتب"
    );


    const investorsSheet =
        XLSX.utils.json_to_sheet(
            data.investorsInfo.rows.map(
                investor => ({

                    "المستثمر": investor.name || "-",
                    "رأس المال": investor.capital,
                    "النسبة %": Number(investor.percent.toFixed(2)),
                    "نصيبه من ربح الفترة": Number(investor.share.toFixed(2))

                })
            )
        );

    XLSX.utils.book_append_sheet(
        workbook,
        investorsSheet,
        "توزيع الأرباح"
    );


    const cashFlowSheet =
        XLSX.utils.aoa_to_sheet([

            ["البند", "القيمة"],
            ["نقد داخل (محصّل من المبيعات)", data.cashFlow.cashIn],
            ["نقد خارج - مشتريات", data.cashFlow.cashOutPurchases],
            ["نقد خارج - مصروفات", data.cashFlow.cashOutExpenses],
            ["صافي التدفق النقدي", data.cashFlow.net]

        ]);

    XLSX.utils.book_append_sheet(
        workbook,
        cashFlowSheet,
        "التدفق النقدي"
    );


    const expensesSheet =
        XLSX.utils.json_to_sheet(
            data.expenseBreakdown.map(
                row => ({

                    "النوع": row.category,
                    "الإجمالي": row.total,
                    "النسبة %": Number(row.percent.toFixed(1))

                })
            )
        );

    XLSX.utils.book_append_sheet(
        workbook,
        expensesSheet,
        "المصروفات"
    );


    const fileName =
        `تقرير-${data.from}-إلى-${data.to}.xlsx`;

    XLSX.writeFile(
        workbook,
        fileName
    );

    showToast(
        "تم تصدير التقرير بنجاح",
        "success"
    );

}


// =========================================================
// التقارير
// =========================================================

function generateReports() {

    const from =
        getValue(
            "reportDateFrom"
        );


    const to =
        getValue(
            "reportDateTo"
        );


    if (!from || !to) {

        showToast(
            "حدد بداية ونهاية الفترة",
            "warning"
        );

        return;

    }


    const sales =
        filterByDateRange(
            systemData.sales,
            from,
            to
        );


    const purchases =
        filterByDateRange(
            systemData.purchases,
            from,
            to
        );


    const expenses =
        filterByDateRange(
            systemData.expenses,
            from,
            to
        );


    const salesTotal =
        calcSalesTotal(sales);

    const purchasesTotal =
        calcPurchasesTotal(purchases);

    const expensesTotal =
        calcExpensesTotal(expenses);

    const costOfSales =
        calcCostOfSales(sales);

    const grossProfit =
        salesTotal -
        costOfSales;

    const netProfit =
        grossProfit -
        expensesTotal;

    const margin =
        salesTotal > 0
        ?
        (grossProfit / salesTotal * 100)
        :
        0;


    const topProducts =
        topProductsFromSales(
            sales,
            5
        );

    const topCustomers =
        topCustomersFromSales(
            sales,
            5
        );

    const expenseBreakdown =
        expensesByCategory(
            expenses
        );

    const debtors =
        topDebtors(5);

    const totalReceivables =
        sumBy(
            systemData.sales,
            sale => Math.max(0, toNumber(sale.remaining))
        );


    const timeSeries =
        buildSalesTimeSeries(
            sales,
            from,
            to
        );


    // -----------------------------------------
    // بيانات إضافية: ربحية تفصيلية + موردون +
    // رواتب + مستثمرون + تدفق نقدي
    // -----------------------------------------

    const allProducts =
        topProductsFromSales(
            sales,
            999999,
            "profit"
        );

    const allCustomers =
        customerProfitability(
            sales
        );

    const suppliersPerf =
        supplierPerformance(
            purchases
        );

    const payroll =
        payrollSummary();

    const investorsInfo =
        investorsDistribution(
            netProfit
        );

    const cashFlow =
        calculateCashFlow(
            sales,
            purchases,
            expenses
        );


    // نخزّن آخر بيانات تقرير مُنشأة لاستخدامها
    // بالتصدير لـ Excel

    window.lastReportData = {

        from,
        to,
        salesTotal,
        purchasesTotal,
        expensesTotal,
        costOfSales,
        grossProfit,
        netProfit,
        margin,
        allProducts,
        allCustomers,
        suppliersPerf,
        payroll,
        investorsInfo,
        cashFlow,
        expenseBreakdown,
        debtors

    };


    const container =
        document.getElementById(
            "reportsContent"
        );


    if (!container) return;


    container.innerHTML = `

        <div class="stats-grid">

            <div class="stat-card">
                <div class="stat-icon">$</div>
                <div>
                    <span>المبيعات</span>
                    <strong>${formatMoney(salesTotal)}</strong>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">+</div>
                <div>
                    <span>المشتريات</span>
                    <strong>${formatMoney(purchasesTotal)}</strong>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">!</div>
                <div>
                    <span>المصروفات</span>
                    <strong>${formatMoney(expensesTotal)}</strong>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">◈</div>
                <div>
                    <span>تكلفة البضاعة المباعة</span>
                    <strong>${formatMoney(costOfSales)}</strong>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">≈</div>
                <div>
                    <span>مجمل الربح</span>
                    <strong>${formatMoney(grossProfit)}</strong>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">%</div>
                <div>
                    <span>صافي الربح (هامش ${margin.toFixed(1)}%)</span>
                    <strong>${formatMoney(netProfit)}</strong>
                </div>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>اتجاه المبيعات خلال الفترة</h3>
                    <p>من ${formatDate(from)} إلى ${formatDate(to)}</p>
                </div>
            </div>

            ${renderBarChartHtml(timeSeries.points, timeSeries.granularity)}

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>ملخص الفترة</h3>
                    <p>من ${formatDate(from)} إلى ${formatDate(to)}</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>البند</th>
                            <th>القيمة</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>إجمالي المبيعات</td>
                            <td>${formatMoney(salesTotal)}</td>
                        </tr>
                        <tr>
                            <td>إجمالي المشتريات</td>
                            <td>${formatMoney(purchasesTotal)}</td>
                        </tr>
                        <tr>
                            <td>إجمالي المصروفات</td>
                            <td>${formatMoney(expensesTotal)}</td>
                        </tr>
                        <tr>
                            <td>تكلفة البضاعة المباعة</td>
                            <td>${formatMoney(costOfSales)}</td>
                        </tr>
                        <tr>
                            <td>مجمل الربح</td>
                            <td>${formatMoney(grossProfit)}</td>
                        </tr>
                        <tr>
                            <td><strong>صافي الربح</strong></td>
                            <td><strong>${formatMoney(netProfit)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>أفضل 5 منتجات مبيعًا</h3>
                    <p>حسب الإيراد خلال الفترة المحددة</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>المنتج</th>
                            <th>الكمية المباعة</th>
                            <th>الإيراد</th>
                            <th>الربح التقديري</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            topProducts.length
                            ?
                            topProducts.map(product => `
                                <tr>
                                    <td>${escapeHtml(product.name)}</td>
                                    <td>${formatNumber(product.qty)}</td>
                                    <td>${formatMoney(product.revenue)}</td>
                                    <td>${formatMoney(product.profit)}</td>
                                </tr>
                            `).join("")
                            :
                            `<tr><td colspan="4" class="text-center text-muted">لا توجد مبيعات بهذه الفترة</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>أفضل 5 عملاء</h3>
                    <p>حسب إجمالي المشتريات خلال الفترة</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>العميل</th>
                            <th>عدد الفواتير</th>
                            <th>الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            topCustomers.length
                            ?
                            topCustomers.map(customer => `
                                <tr>
                                    <td>${escapeHtml(customer.name)}</td>
                                    <td>${formatNumber(customer.invoices)}</td>
                                    <td>${formatMoney(customer.total)}</td>
                                </tr>
                            `).join("")
                            :
                            `<tr><td colspan="3" class="text-center text-muted">لا توجد مبيعات بهذه الفترة</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>المصروفات حسب النوع</h3>
                    <p>توزيع المصروفات خلال الفترة</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>النوع</th>
                            <th>الإجمالي</th>
                            <th>النسبة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            expenseBreakdown.length
                            ?
                            expenseBreakdown.map(row => `
                                <tr>
                                    <td>${escapeHtml(row.category)}</td>
                                    <td>${formatMoney(row.total)}</td>
                                    <td>${row.percent.toFixed(1)}%</td>
                                </tr>
                            `).join("")
                            :
                            `<tr><td colspan="3" class="text-center text-muted">لا توجد مصروفات بهذه الفترة</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>أكبر مديونيات العملاء</h3>
                    <p>
                        إجمالي المتبقي حاليًا على كل العملاء:
                        <strong>${formatMoney(totalReceivables)}</strong>
                        (بغض النظر عن فترة التقرير)
                    </p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>العميل</th>
                            <th>عدد الفواتير غير المسددة بالكامل</th>
                            <th>المبلغ المتبقي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            debtors.length
                            ?
                            debtors.map(debtor => `
                                <tr>
                                    <td>${escapeHtml(debtor.name)}</td>
                                    <td>${formatNumber(debtor.invoices)}</td>
                                    <td>${formatMoney(debtor.remaining)}</td>
                                </tr>
                            `).join("")
                            :
                            `<tr><td colspan="3" class="text-center text-muted">لا توجد مديونيات حاليًا</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>ربحية تفصيلية لكل الأصناف</h3>
                    <p>مرتبة حسب الربح الفعلي (الإيراد - التكلفة) خلال الفترة</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الصنف</th>
                            <th>الكمية المباعة</th>
                            <th>الإيراد</th>
                            <th>التكلفة</th>
                            <th>الربح</th>
                            <th>هامش الربح</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            allProducts.length
                            ?
                            allProducts.map(product => `
                                <tr>
                                    <td>${escapeHtml(product.name)}</td>
                                    <td>${formatNumber(product.qty)}</td>
                                    <td>${formatMoney(product.revenue)}</td>
                                    <td>${formatMoney(product.cost)}</td>
                                    <td>${formatMoney(product.profit)}</td>
                                    <td>${product.revenue > 0 ? (product.profit / product.revenue * 100).toFixed(1) : "0.0"}%</td>
                                </tr>
                            `).join("")
                            :
                            `<tr><td colspan="6" class="text-center text-muted">لا توجد مبيعات بهذه الفترة</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>ربحية تفصيلية لكل عميل</h3>
                    <p>الإيراد، الربح، متوسط الفاتورة، والمتبقي عليه حاليًا</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>العميل</th>
                            <th>عدد الفواتير</th>
                            <th>الإيراد</th>
                            <th>الربح</th>
                            <th>هامش الربح</th>
                            <th>متوسط الفاتورة</th>
                            <th>المتبقي عليه حاليًا</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            allCustomers.length
                            ?
                            allCustomers.map(customer => `
                                <tr>
                                    <td>${escapeHtml(customer.name)}</td>
                                    <td>${formatNumber(customer.invoices)}</td>
                                    <td>${formatMoney(customer.revenue)}</td>
                                    <td>${formatMoney(customer.profit)}</td>
                                    <td>${customer.margin.toFixed(1)}%</td>
                                    <td>${formatMoney(customer.avgOrderValue)}</td>
                                    <td>${formatMoney(customer.outstanding)}</td>
                                </tr>
                            `).join("")
                            :
                            `<tr><td colspan="7" class="text-center text-muted">لا توجد مبيعات بهذه الفترة</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>أداء الموردين</h3>
                    <p>إجمالي المشتريات (بالعملة الأساسية) خلال الفترة، والرصيد المستحق حاليًا</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>المورد</th>
                            <th>عدد الفواتير</th>
                            <th>إجمالي المشتريات</th>
                            <th>المستحق له حاليًا</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            suppliersPerf.length
                            ?
                            suppliersPerf.map(supplier => `
                                <tr>
                                    <td>${escapeHtml(supplier.name)}</td>
                                    <td>${formatNumber(supplier.invoices)}</td>
                                    <td>${formatMoney(supplier.total)}</td>
                                    <td>${formatMoney(supplier.balance)}</td>
                                </tr>
                            `).join("")
                            :
                            `<tr><td colspan="4" class="text-center text-muted">لا توجد مشتريات بهذه الفترة</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>تكلفة الرواتب الحالية</h3>
                    <p>
                        إجمالي رواتب العمال المسجّلين حاليًا:
                        <strong>${formatMoney(payroll.total)}</strong>
                        (بغض النظر عن فترة التقرير - هي القيمة الحالية المسجّلة)
                    </p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الاسم</th>
                            <th>الوظيفة</th>
                            <th>نوع الراتب</th>
                            <th>الراتب</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            payroll.employees.length
                            ?
                            payroll.employees.map(employee => `
                                <tr>
                                    <td>${escapeHtml(employee.name || "-")}</td>
                                    <td>${escapeHtml(employee.job || "-")}</td>
                                    <td>${escapeHtml(employee.salaryType || "-")}</td>
                                    <td>${formatMoney(employee.salary)}</td>
                                </tr>
                            `).join("")
                            :
                            `<tr><td colspan="4" class="text-center text-muted">لا يوجد عمال مسجّلون</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>توزيع صافي ربح الفترة على المستثمرين</h3>
                    <p>حسب نسبة رأس مال كل مستثمر من إجمالي رأس المال (صافي ربح الفترة: ${formatMoney(netProfit)})</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>المستثمر</th>
                            <th>رأس المال</th>
                            <th>النسبة</th>
                            <th>نصيبه من ربح الفترة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            investorsInfo.rows.length
                            ?
                            investorsInfo.rows.map(investor => `
                                <tr>
                                    <td>${escapeHtml(investor.name || "-")}</td>
                                    <td>${formatMoney(investor.capital)}</td>
                                    <td>${investor.percent.toFixed(2)}%</td>
                                    <td>${formatMoney(investor.share)}</td>
                                </tr>
                            `).join("")
                            :
                            `<tr><td colspan="4" class="text-center text-muted">لا يوجد مستثمرون أو رأس المال يساوي صفر</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>التدفق النقدي التقديري للفترة</h3>
                    <p>نقد داخل (المحصّل فعليًا من المبيعات) مقابل نقد خارج (مشتريات + مصروفات) — تقديري، راجع الملاحظة أسفل الجدول</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>البند</th>
                            <th>القيمة</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>نقد داخل (محصّل من المبيعات)</td>
                            <td>${formatMoney(cashFlow.cashIn)}</td>
                        </tr>
                        <tr>
                            <td>نقد خارج - مشتريات</td>
                            <td>${formatMoney(cashFlow.cashOutPurchases)}</td>
                        </tr>
                        <tr>
                            <td>نقد خارج - مصروفات</td>
                            <td>${formatMoney(cashFlow.cashOutExpenses)}</td>
                        </tr>
                        <tr>
                            <td><strong>صافي التدفق النقدي</strong></td>
                            <td><strong>${formatMoney(cashFlow.net)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p class="text-muted" style="padding:12px 16px;font-size:12px;">
                ملاحظة: هاد تقدير مبني على افتراض إن المشتريات والمصروفات تُدفع نقدًا بالكامل وقت تسجيلها،
                وإن "النقد الداخل" هو المبلغ المدفوع فعليًا وقت إنشاء فاتورة البيع فقط (مش أي تحصيل لاحق
                على المتبقي، لأنه النظام حاليًا ما بيسجل دفعات لاحقة على فواتير قديمة).
            </p>

        </div>

    `;

}


// =========================================================
// التحليل
// =========================================================

function toggleAnalysisCustomRange() {

    const period =
        getValue(
            "analysisPeriod"
        );

    const wrapper =
        document.getElementById(
            "analysisCustomRange"
        );

    if (!wrapper) return;


    if (period === "custom") {

        wrapper.classList.remove(
            "hidden"
        );

    } else {

        wrapper.classList.add(
            "hidden"
        );

    }

}


// -----------------------------------------
// نطاق التحليل الفعلي بحسب الاختيار
// -----------------------------------------

function getAnalysisRange() {

    const period =
        getValue(
            "analysisPeriod"
        ) ||
        "month";

    const today =
        new Date();

    const toStr =
        today.toISOString().split("T")[0];


    if (period === "all") {

        return {
            from: null,
            to: null,
            label: "كل الفترات"
        };

    }


    if (period === "custom") {

        const from =
            getValue("analysisDateFrom");

        const to =
            getValue("analysisDateTo");

        return {
            from: from || null,
            to: to || null,
            label: "فترة مخصصة"
        };

    }


    let fromDate =
        new Date(
            today.getFullYear(),
            today.getMonth(),
            1
        );

    let label = "هذا الشهر";


    if (period === "quarter") {

        const quarterStartMonth =
            Math.floor(today.getMonth() / 3) * 3;

        fromDate =
            new Date(
                today.getFullYear(),
                quarterStartMonth,
                1
            );

        label = "هذا الربع";

    } else if (period === "year") {

        fromDate =
            new Date(
                today.getFullYear(),
                0,
                1
            );

        label = "هذا العام";

    }


    return {

        from:
            fromDate.toISOString().split("T")[0],

        to: toStr,

        label

    };

}


function runAnalysis() {

    const range =
        getAnalysisRange();


    if (
        (range.from && !range.to) ||
        (!range.from && range.to)
    ) {

        showToast(
            "حدد بداية ونهاية الفترة المخصصة",
            "warning"
        );

        return;

    }


    const sales =
        range.from
        ?
        filterByDateRange(systemData.sales, range.from, range.to)
        :
        systemData.sales;

    const purchases =
        range.from
        ?
        filterByDateRange(systemData.purchases, range.from, range.to)
        :
        systemData.purchases;

    const expenses =
        range.from
        ?
        filterByDateRange(systemData.expenses, range.from, range.to)
        :
        systemData.expenses;


    const salesTotal =
        calcSalesTotal(sales);

    const costOfSales =
        calcCostOfSales(sales);

    const expensesTotal =
        calcExpensesTotal(expenses);

    const grossProfit =
        salesTotal -
        costOfSales;

    const netProfit =
        grossProfit -
        expensesTotal;

    const margin =
        salesTotal > 0
        ?
        (grossProfit / salesTotal * 100)
        :
        0;

    const expenseRatio =
        salesTotal > 0
        ?
        (expensesTotal / salesTotal * 100)
        :
        0;

    const cogsRatio =
        salesTotal > 0
        ?
        (costOfSales / salesTotal * 100)
        :
        0;


    // -----------------------------------------
    // مقارنة مع الفترة السابقة (لو الفترة محددة)
    // -----------------------------------------

    let comparisonHtml = "";

    if (range.from && range.to) {

        const previousRange =
            getPreviousRange(
                range.from,
                range.to
            );

        const previousSales =
            filterByDateRange(
                systemData.sales,
                previousRange.from,
                previousRange.to
            );

        const previousExpenses =
            filterByDateRange(
                systemData.expenses,
                previousRange.from,
                previousRange.to
            );

        const previousSalesTotal =
            calcSalesTotal(previousSales);

        const previousCostOfSales =
            calcCostOfSales(previousSales);

        const previousGrossProfit =
            previousSalesTotal -
            previousCostOfSales;

        const previousExpensesTotal =
            calcExpensesTotal(previousExpenses);

        const previousNetProfit =
            previousGrossProfit -
            previousExpensesTotal;


        comparisonHtml = `

            <div class="panel">

                <div class="panel-header">
                    <div>
                        <h3>مقارنة مع الفترة السابقة</h3>
                        <p>
                            الفترة السابقة: من ${formatDate(previousRange.from)}
                            إلى ${formatDate(previousRange.to)}
                        </p>
                    </div>
                </div>

                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>المؤشر</th>
                                <th>الفترة الحالية</th>
                                <th>الفترة السابقة</th>
                                <th>التغيّر</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>المبيعات</td>
                                <td>${formatMoney(salesTotal)}</td>
                                <td>${formatMoney(previousSalesTotal)}</td>
                                <td>${growthBadgeHtml(salesTotal, previousSalesTotal)}</td>
                            </tr>
                            <tr>
                                <td>مجمل الربح</td>
                                <td>${formatMoney(grossProfit)}</td>
                                <td>${formatMoney(previousGrossProfit)}</td>
                                <td>${growthBadgeHtml(grossProfit, previousGrossProfit)}</td>
                            </tr>
                            <tr>
                                <td>صافي الربح</td>
                                <td>${formatMoney(netProfit)}</td>
                                <td>${formatMoney(previousNetProfit)}</td>
                                <td>${growthBadgeHtml(netProfit, previousNetProfit)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

            </div>

        `;

    }


    // -----------------------------------------
    // أكثر 5 منتجات ربحية
    // -----------------------------------------

    const mostProfitableProducts =
        topProductsFromSales(
            sales,
            5,
            "profit"
        );


    // -----------------------------------------
    // معدل دوران المخزون (تقريبي)
    // -----------------------------------------

    const currentInventoryValue =
        calculateInventoryCost();

    const inventoryTurnover =
        currentInventoryValue > 0
        ?
        (costOfSales / currentInventoryValue)
        :
        0;


    // -----------------------------------------
    // تنبيهات وتوقعات ذكية
    // -----------------------------------------

    const slowMovingProducts =
        detectSlowMovingProducts(60)
            .slice(0, 10);

    const lowStockProducts =
        detectLowStockProducts();

    let trendingProducts = {
        growing: [],
        declining: []
    };

    if (range.from && range.to) {

        const previousRangeForTrend =
            getPreviousRange(
                range.from,
                range.to
            );

        const previousSalesForTrend =
            filterByDateRange(
                systemData.sales,
                previousRangeForTrend.from,
                previousRangeForTrend.to
            );

        trendingProducts =
            detectTrendingProducts(
                sales,
                previousSalesForTrend
            );

    }

    const forecast =
        forecastNextPeriodRevenue();


    const container =
        document.getElementById(
            "analysisContent"
        );


    if (!container) return;


    container.innerHTML = `

        <div class="stats-grid">

            <div class="stat-card">
                <div class="stat-icon">$</div>
                <div>
                    <span>إجمالي المبيعات (${range.label})</span>
                    <strong>${formatMoney(salesTotal)}</strong>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">◈</div>
                <div>
                    <span>تكلفة البضاعة المباعة</span>
                    <strong>${formatMoney(costOfSales)}</strong>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">≈</div>
                <div>
                    <span>مجمل الربح</span>
                    <strong>${formatMoney(grossProfit)}</strong>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">%</div>
                <div>
                    <span>هامش الربح الإجمالي</span>
                    <strong>${margin.toFixed(2)}%</strong>
                </div>
            </div>

        </div>


        <div class="analysis-card">
            <h3>صافي الربح بعد المصروفات</h3>
            <p style="margin-top:10px;font-size:24px;font-weight:700;">
                ${formatMoney(netProfit)}
            </p>
        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>مؤشرات إضافية</h3>
                    <p>نسب مفيدة لفهم صحة النشاط ماليًا</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>المؤشر</th>
                            <th>القيمة</th>
                            <th>ملاحظة</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>نسبة تكلفة البضاعة من المبيعات</td>
                            <td>${cogsRatio.toFixed(1)}%</td>
                            <td class="text-muted">كل ما قلّت، زاد هامش الربح</td>
                        </tr>
                        <tr>
                            <td>نسبة المصروفات من المبيعات</td>
                            <td>${expenseRatio.toFixed(1)}%</td>
                            <td class="text-muted">كل ما قلّت، تحسّن صافي الربح</td>
                        </tr>
                        <tr>
                            <td>معدل دوران المخزون (تقريبي)</td>
                            <td>${inventoryTurnover.toFixed(2)}×</td>
                            <td class="text-muted">
                                قيمة المخزون الحالية: ${formatMoney(currentInventoryValue)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

        </div>


        ${comparisonHtml}


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>أكثر 5 منتجات ربحية</h3>
                    <p>حسب الربح الفعلي (الإيراد - التكلفة) خلال الفترة</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>المنتج</th>
                            <th>الكمية المباعة</th>
                            <th>الإيراد</th>
                            <th>الربح</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            mostProfitableProducts.length
                            ?
                            mostProfitableProducts.map(product => `
                                <tr>
                                    <td>${escapeHtml(product.name)}</td>
                                    <td>${formatNumber(product.qty)}</td>
                                    <td>${formatMoney(product.revenue)}</td>
                                    <td>${formatMoney(product.profit)}</td>
                                </tr>
                            `).join("")
                            :
                            `<tr><td colspan="4" class="text-center text-muted">لا توجد بيانات كافية</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>توقع مبيعات الشهر القادم (تقديري)</h3>
                    <p>تقدير مبني على متوسط نسبة النمو خلال آخر عدة أشهر فعلية - وليس ضمانًا</p>
                </div>
            </div>

            ${
                forecast
                ?
                `
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>آخر شهر مكتمل بالبيانات</th>
                                <th>مبيعاته</th>
                                <th>متوسط نسبة النمو الشهري</th>
                                <th>المبيعات المتوقعة للشهر القادم</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${forecast.lastMonth}</td>
                                <td>${formatMoney(forecast.lastValue)}</td>
                                <td>${forecast.avgGrowth >= 0 ? "+" : ""}${forecast.avgGrowth.toFixed(1)}%</td>
                                <td><strong>${formatMoney(forecast.forecast)}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                `
                :
                `<div class="empty-state">لا توجد بيانات كافية (نحتاج مبيعات مسجّلة بشهرين على الأقل)</div>`
            }

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>أصناف صاعدة وأصناف متراجعة</h3>
                    <p>مقارنة كمية المبيعات بين الفترة الحالية والفترة السابقة مباشرة لها</p>
                </div>
            </div>

            <div class="table-wrapper" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px;">

                <div>
                    <h4 style="margin-bottom:8px;">▲ الأكثر نموًا</h4>
                    <table class="data-table">
                        <thead>
                            <tr><th>الصنف</th><th>النمو</th></tr>
                        </thead>
                        <tbody>
                            ${
                                trendingProducts.growing.length
                                ?
                                trendingProducts.growing.map(product => `
                                    <tr>
                                        <td>${escapeHtml(product.name)}</td>
                                        <td>${growthBadgeHtml(product.qty, product.previousQty)}</td>
                                    </tr>
                                `).join("")
                                :
                                `<tr><td colspan="2" class="text-center text-muted">لا يوجد</td></tr>`
                            }
                        </tbody>
                    </table>
                </div>

                <div>
                    <h4 style="margin-bottom:8px;">▼ الأكثر تراجعًا</h4>
                    <table class="data-table">
                        <thead>
                            <tr><th>الصنف</th><th>التراجع</th></tr>
                        </thead>
                        <tbody>
                            ${
                                trendingProducts.declining.length
                                ?
                                trendingProducts.declining.map(product => `
                                    <tr>
                                        <td>${escapeHtml(product.name)}</td>
                                        <td>${growthBadgeHtml(product.qty, product.previousQty)}</td>
                                    </tr>
                                `).join("")
                                :
                                `<tr><td colspan="2" class="text-center text-muted">لا يوجد</td></tr>`
                            }
                        </tbody>
                    </table>
                </div>

            </div>

            ${
                !(range.from && range.to)
                ?
                `<p class="text-muted" style="padding:0 16px 16px;font-size:12px;">
                    لعرض هاد التحليل، اختر فترة محددة (شهر / ربع / سنة / فترة مخصصة) بدل "كل الفترات".
                </p>`
                :
                ""
            }

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>أصناف راكدة (بدون مبيعات آخر 60 يوم)</h3>
                    <p>عندها مخزون حالي لكن ما تباعت من فترة - رأس مال معطّل</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الصنف</th>
                            <th>الكمية بالمخزون</th>
                            <th>آخر تاريخ بيع</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            slowMovingProducts.length
                            ?
                            slowMovingProducts.map(product => `
                                <tr>
                                    <td>${escapeHtml(product.name)}</td>
                                    <td>${formatNumber(product.quantity)}</td>
                                    <td>${product.lastSaleDate ? formatDate(product.lastSaleDate) : "لم يُبع أبدًا"}</td>
                                </tr>
                            `).join("")
                            :
                            `<tr><td colspan="3" class="text-center text-muted">لا توجد أصناف راكدة حاليًا 👍</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

        </div>


        <div class="panel">

            <div class="panel-header">
                <div>
                    <h3>تنبيه: أصناف عندها مخزون منخفض</h3>
                    <p>وصلت للحد الأدنى المسجّل أو أقل - قرّب وقت إعادة الطلب</p>
                </div>
            </div>

            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الصنف</th>
                            <th>الكمية الحالية</th>
                            <th>الحد الأدنى</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            lowStockProducts.length
                            ?
                            lowStockProducts.map(product => `
                                <tr>
                                    <td>${escapeHtml(product.name)}</td>
                                    <td>${formatNumber(product.quantity)}</td>
                                    <td>${formatNumber(product.minStock)}</td>
                                </tr>
                            `).join("")
                            :
                            `<tr><td colspan="3" class="text-center text-muted">لا توجد أصناف تحت الحد الأدنى حاليًا 👍</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

        </div>

    `;

}


// =========================================================
// نافذة Modal
// =========================================================

function openModal(
    title,
    body,
    buttons = [],
    sizeClass = ""
) {

    const container =
        document.getElementById(
            "modalContainer"
        );


    if (!container) return;


    const buttonsHtml =
        buttons.map(
            (
                button,
                index
            ) => `

            <button
                type="button"
                id="modalButton${index}"
                class="${button.className || "btn btn-primary"}">

                ${escapeHtml(
                    button.text
                )}

            </button>

        `
        ).join("");


    container.innerHTML = `

        <div class="modal ${sizeClass}">

            <div class="modal-header">

                <h3>
                    ${escapeHtml(
                        title
                    )}
                </h3>

                <button
                    type="button"
                    class="modal-close"
                    onclick="closeModal()">

                    ×

                </button>

            </div>


            <div class="modal-body">

                ${body}

            </div>


            ${
                buttons.length
                ?
                `
                <div class="modal-footer">

                    ${buttonsHtml}

                </div>
                `
                :
                ""
            }

        </div>

    `;


    container.classList.remove(
        "hidden"
    );


    buttons.forEach(
        (
            button,
            index
        ) => {

            const element =
                document.getElementById(
                    `modalButton${index}`
                );


            if (!element) return;


            element.addEventListener(
                "click",
                function () {

                    button.action();

                }
            );

        }
    );


    container.onclick =
        function (event) {

            if (
                event.target ===
                container
            ) {

                closeModal();

            }

        };

}


// =========================================================
// إغلاق Modal
// =========================================================

function closeModal() {

    const container =
        document.getElementById(
            "modalContainer"
        );


    if (!container) return;


    container.classList.add(
        "hidden"
    );


    container.innerHTML = "";

    window.purchaseModalCart =
        [];


    window.saleModalCart =
        [];

}


// =========================================================
// Toast
// =========================================================

function showToast(
    message,
    type = "info"
) {

    const container =
        document.getElementById(
            "toastContainer"
        );


    if (!container) return;


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        `toast ${type}`;


    toast.textContent =
        message;


    container.appendChild(
        toast
    );


    setTimeout(
        () => {

            toast.remove();

        },
        3500
    );

}


// =========================================================
// أدوات
// =========================================================

function getValue(
    id
) {

    const element =
        document.getElementById(
            id
        );


    return element
        ?
        element.value
        :
        "";

}


function setInputValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.value =
            value ??
            "";

    }

}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value ??
            "";

    }

}


function toNumber(
    value
) {

    const number =
        Number(
            String(
                value ??
                ""
            )
            .replace(
                /,/g,
                ""
            )
        );


    return Number.isFinite(
        number
    )
    ?
    number
    :
    0;

}


function formatMoney(
    value
) {

    return toNumber(
        value
    ).toLocaleString(
        "ar-EG",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}


function formatNumber(
    value
) {

    return toNumber(
        value
    ).toLocaleString(
        "ar-EG",
        {
            maximumFractionDigits: 3
        }
    );

}


function formatDate(
    value
) {

    if (!value) return "-";


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(
            value
        );

    }


    return date.toLocaleDateString(
        "ar-EG"
    );

}


// =========================================================
// تاريخ Firestore
// =========================================================

function normalizeFirestoreDate(
    value
) {

    if (!value) return "";


    if (
        typeof value.toDate ===
        "function"
    ) {

        return value
            .toDate()
            .toISOString()
            .split("T")[0];

    }


    if (
        value.seconds
    ) {

        return new Date(
            value.seconds * 1000
        )
            .toISOString()
            .split("T")[0];

    }


    return String(
        value
    )
    .split("T")[0];

}


// =========================================================
// تاريخ السجل
// =========================================================

function getRecordDate(
    record
) {

    if (!record) return "";


    if (record.date) {

        return String(
            record.date
        ).split("T")[0];

    }


    if (record.createdAt) {

        return normalizeFirestoreDate(
            record.createdAt
        );

    }


    if (record.updatedAt) {

        return normalizeFirestoreDate(
            record.updatedAt
        );

    }


    return "";

}


// =========================================================
// البحث الذكي
// =========================================================
//
// كل كلمة يتم البحث عنها منفصلة.
// وبالتالي:
// "الصن التجر"
// يمكن أن تطابق:
// "التاجر الصنف"
//
// =========================================================

function normalizeSearchText(
    text
) {

    return String(
        text ??
        ""
    )
    .toLowerCase()
    .replace(
        /[\u064B-\u065F\u0670]/g,
        ""
    )
    .replace(
        /[إأآا]/g,
        "ا"
    )
    .replace(
        /ى/g,
        "ي"
    )
    .replace(
        /ة/g,
        "ه"
    )
    .replace(
        /ؤ/g,
        "و"
    )
    .replace(
        /ئ/g,
        "ي"
    )
    .trim();

}


function matchesSearch(
    fields,
    searchText
) {

    const normalized =
        normalizeSearchText(
            searchText
        );


    if (!normalized) {

        return true;

    }


    const words =
        normalized
            .split(
                /\s+/
            )
            .filter(Boolean);


    const haystack =
        fields
            .map(
                field =>
                    normalizeSearchText(
                        field
                    )
            )
            .join(" ");


    return words.every(
        word =>
            haystack.includes(
                word
            )
    );

}


// =========================================================
// حماية HTML
// =========================================================

function escapeHtml(
    value
) {

    return String(
        value ??
        ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );

}


// =========================================================
// رقم فاتورة
// =========================================================

function generateInvoiceNumber(
    prefix
) {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        )
        .padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        )
        .padStart(
            2,
            "0"
        );


    const time =
        String(
            Date.now()
        )
        .slice(
            -5
        );


    return `${prefix}-${year}${month}${day}-${time}`;

}


// =========================================================
// تصدير الدوال التي تستخدمها HTML
// =========================================================
//
// لأن app.js يعمل كـ ES Module، الدوال لا تصبح
// تلقائيًا متاحة لـ onclick الموجودة في index.html.
// لذلك نضعها على window.
//
// =========================================================

window.showPage =
    showPage;

window.toggleSidebar =
    toggleSidebar;

window.closeSidebar =
    closeSidebar;

window.refreshCurrentPage =
    refreshCurrentPage;

window.saveSettings =
    saveSettings;

window.newSale =
    newSale;

window.newPurchase =
    newPurchase;

window.newExpense =
    newExpense;

window.newProduct =
    newProduct;

window.newCustomer =
    newCustomer;

window.newSupplier =
    newSupplier;

window.newEmployee =
    newEmployee;

window.newInvestor =
    newInvestor;

window.searchSales =
    searchSales;

window.filterSales =
    filterSales;

window.searchPurchases =
    searchPurchases;

window.searchInventory =
    searchInventory;

window.filterInventory =
    filterInventory;

window.calculateDeadStock =
    calculateDeadStock;

window.searchCustomers =
    searchCustomers;

window.searchSuppliers =
    searchSuppliers;

window.searchEmployees =
    searchEmployees;

window.editProduct =
    editProduct;

window.deleteProduct =
    deleteProduct;

window.editCustomer =
    editCustomer;

window.deleteCustomer =
    deleteCustomer;

window.editSupplier =
    editSupplier;

window.deleteSupplier =
    deleteSupplier;

window.editEmployee =
    editEmployee;

window.deleteEmployee =
    deleteEmployee;

window.editInvestor =
    editInvestor;

window.deleteInvestor =
    deleteInvestor;

window.editExpense =
    editExpense;

window.deleteExpense =
    deleteExpense;

window.editProduct =
    editProduct;

window.viewPurchase =
    viewPurchase;

window.deletePurchase =
    deletePurchase;

window.viewSale =
    viewSale;

window.deleteSale =
    deleteSale;

window.searchPurchaseSuppliers =
    searchPurchaseSuppliers;

window.selectPurchaseSupplier =
    selectPurchaseSupplier;

window.searchPurchaseProducts =
    searchPurchaseProducts;

window.selectPurchaseProduct =
    selectPurchaseProduct;

window.addPurchaseItem =
    addPurchaseItem;

window.removePurchaseItem =
    removePurchaseItem;

window.updatePurchaseTotals =
    updatePurchaseTotals;

window.searchSaleCustomers =
    searchSaleCustomers;

window.selectSaleCustomer =
    selectSaleCustomer;

window.searchSaleProducts =
    searchSaleProducts;

window.selectSaleProduct =
    selectSaleProduct;

window.addSaleItem =
    addSaleItem;

window.removeSaleItem =
    removeSaleItem;

window.updateSaleTotals =
    updateSaleTotals;

window.generateReports =
    generateReports;

window.runAnalysis =
    runAnalysis;

window.calculateProfitDistribution =
    calculateProfitDistribution;

window.closeModal =
    closeModal;

window.logoutUser =
    logoutUser;

window.exportReportsToExcel =
    exportReportsToExcel;

window.newEmployeeAccount =
    newEmployeeAccount;

window.toggleAnalysisCustomRange =
    toggleAnalysisCustomRange;


// =========================================================
// نهاية الملف
// =========================================================