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
    auth
} from "./firebase-config.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

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

let currentUser = null;

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
             console.log("زر تسجيل الدخول تم العثور عليه");

        if (loginButton) {

            loginButton.addEventListener(
                "click",
                loginUser
            );

        }

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

        document.getElementById(
            "loginScreen"
        ).style.display = "none";

        await initializeFirebase();

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
            "حذف الفاتورة لا يعكس المخزون تلقائيًا في هذه المرحلة. هل تريد المتابعة؟"
        )
    ) {

        return;

    }


    try {

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
            "تم حذف الفاتورة",
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


    const available =
        toNumber(
            product.quantity
        );


    if (
        quantity >
        available
    ) {

        showToast(
            "الكمية المطلوبة أكبر من المخزون المتاح",
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
                toNumber(
                    product.quantity
                ) -
                toNumber(
                    item.quantity
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
            "حذف فاتورة البيع لا يعكس المخزون تلقائيًا في هذه المرحلة. هل تريد المتابعة؟"
        )
    ) {

        return;

    }


    try {

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
            "تم حذف الفاتورة",
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
        systemData.sales.filter(
            sale =>
                getRecordDate(sale)
                >= from &&
                getRecordDate(sale)
                <= to
        );


    const purchases =
        systemData.purchases.filter(
            purchase =>
                getRecordDate(purchase)
                >= from &&
                getRecordDate(purchase)
                <= to
        );


    const expenses =
        systemData.expenses.filter(
            expense =>
                getRecordDate(expense)
                >= from &&
                getRecordDate(expense)
                <= to
        );


    const salesTotal =
        sales.reduce(
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


    const purchasesTotal =
        purchases.reduce(
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


    const expensesTotal =
        expenses.reduce(
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


    const container =
        document.getElementById(
            "reportsContent"
        );


    if (!container) return;


    container.innerHTML = `

        <div class="stats-grid">

            <div class="stat-card">

                <div class="stat-icon">
                    $
                </div>

                <div>

                    <span>
                        المبيعات
                    </span>

                    <strong>
                        ${formatMoney(
                            salesTotal
                        )}
                    </strong>

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-icon">
                    +
                </div>

                <div>

                    <span>
                        المشتريات
                    </span>

                    <strong>
                        ${formatMoney(
                            purchasesTotal
                        )}
                    </strong>

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-icon">
                    !
                </div>

                <div>

                    <span>
                        المصروفات
                    </span>

                    <strong>
                        ${formatMoney(
                            expensesTotal
                        )}
                    </strong>

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-icon">
                    ≈
                </div>

                <div>

                    <span>
                        الفرق
                    </span>

                    <strong>
                        ${formatMoney(
                            salesTotal -
                            purchasesTotal -
                            expensesTotal
                        )}
                    </strong>

                </div>

            </div>

        </div>

        <div class="panel">

            <div class="panel-header">

                <div>

                    <h3>
                        ملخص الفترة
                    </h3>

                    <p>
                        من ${formatDate(from)}
                        إلى ${formatDate(to)}
                    </p>

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

                            <td>
                                إجمالي المبيعات
                            </td>

                            <td>
                                ${formatMoney(
                                    salesTotal
                                )}
                            </td>

                        </tr>


                        <tr>

                            <td>
                                إجمالي المشتريات
                            </td>

                            <td>
                                ${formatMoney(
                                    purchasesTotal
                                )}
                            </td>

                        </tr>


                        <tr>

                            <td>
                                إجمالي المصروفات
                            </td>

                            <td>
                                ${formatMoney(
                                    expensesTotal
                                )}
                            </td>

                        </tr>


                        <tr>

                            <td>
                                صافي الفرق
                            </td>

                            <td>
                                <strong>
                                    ${formatMoney(
                                        salesTotal -
                                        purchasesTotal -
                                        expensesTotal
                                    )}
                                </strong>
                            </td>

                        </tr>

                    </tbody>

                </table>

            </div>

        </div>

    `;

}


// =========================================================
// التحليل
// =========================================================

function runAnalysis() {

    const salesTotal =
        systemData.sales.reduce(
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
        systemData.sales.reduce(
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


                return total +
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
                                    item.cost
                                )
                            ),
                        0
                    );

            },
            0
        );


    const expenses =
        systemData.expenses.reduce(
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


    const grossProfit =
        salesTotal -
        costOfSales;


    const netProfit =
        grossProfit -
        expenses;


    const margin =
        salesTotal > 0
        ?
        (
            grossProfit /
            salesTotal *
            100
        )
        :
        0;


    const container =
        document.getElementById(
            "analysisContent"
        );


    if (!container) return;


    container.innerHTML = `

        <div class="stats-grid">

            <div class="stat-card">

                <div class="stat-icon">
                    $
                </div>

                <div>

                    <span>
                        إجمالي المبيعات
                    </span>

                    <strong>
                        ${formatMoney(
                            salesTotal
                        )}
                    </strong>

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-icon">
                    ◈
                </div>

                <div>

                    <span>
                        تكلفة البضاعة المباعة
                    </span>

                    <strong>
                        ${formatMoney(
                            costOfSales
                        )}
                    </strong>

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-icon">
                    ≈
                </div>

                <div>

                    <span>
                        مجمل الربح
                    </span>

                    <strong>
                        ${formatMoney(
                            grossProfit
                        )}
                    </strong>

                </div>

            </div>


            <div class="stat-card">

                <div class="stat-icon">
                    %
                </div>

                <div>

                    <span>
                        هامش الربح الإجمالي
                    </span>

                    <strong>
                        ${margin.toFixed(2)}%
                    </strong>

                </div>

            </div>

        </div>


        <div class="analysis-card">

            <h3>
                صافي الربح بعد المصروفات
            </h3>

            <p style="margin-top:10px;font-size:24px;font-weight:700;">
                ${formatMoney(
                    netProfit
                )}
            </p>

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


// =========================================================
// نهاية الملف
// =========================================================