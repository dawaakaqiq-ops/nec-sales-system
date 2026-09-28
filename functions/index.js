const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

setGlobalOptions({
  maxInstances: 10,
});


// =========================================================
// إنشاء مستخدم موظف
// =========================================================

exports.createEmployee = onCall(
  async (request) => {

    // -----------------------------------------
    // 1. التأكد أن الشخص مسجل الدخول
    // -----------------------------------------

    if (!request.auth) {

      throw new HttpsError(
        "unauthenticated",
        "يجب تسجيل الدخول أولًا."
      );

    }


    // -----------------------------------------
    // 2. التحقق من صلاحية المدير
    // -----------------------------------------

    const managerRef =
      db
        .collection("users")
        .doc(request.auth.uid);

    const managerSnapshot =
      await managerRef.get();


    if (!managerSnapshot.exists) {

      throw new HttpsError(
        "permission-denied",
        "حساب المستخدم غير موجود."
      );

    }


    const managerData =
      managerSnapshot.data();


    if (
      managerData.role !== "admin" ||
      managerData.active !== true
    ) {

      throw new HttpsError(
        "permission-denied",
        "ليس لديك صلاحية إنشاء مستخدمين."
      );

    }


    // -----------------------------------------
    // 3. قراءة بيانات الموظف
    // -----------------------------------------

    const {
      email,
      password,
      name,
      role = "employee",
      permissions = {}
    } = request.data || {};


    // -----------------------------------------
    // 4. التحقق من البيانات
    // -----------------------------------------

    if (
      !email ||
      !password ||
      !name
    ) {

      throw new HttpsError(
        "invalid-argument",
        "البريد الإلكتروني وكلمة المرور والاسم مطلوبة."
      );

    }


    if (password.length < 6) {

      throw new HttpsError(
        "invalid-argument",
        "كلمة المرور يجب أن تكون 6 أحرف على الأقل."
      );

    }


    if (role === "admin") {

      throw new HttpsError(
        "permission-denied",
        "لا يمكن إنشاء مدير من هذه الشاشة."
      );

    }


    // -----------------------------------------
    // 5. إنشاء حساب Firebase Authentication
    // -----------------------------------------

    let newUser;

    try {

      newUser =
        await auth.createUser({

          email:
            email.trim(),

          password:
            password,

          displayName:
            name.trim(),

          disabled:
            false

        });

    } catch (error) {

      if (
        error.code ===
        "auth/email-already-exists"
      ) {

        throw new HttpsError(
          "already-exists",
          "هذا البريد الإلكتروني مستخدم بالفعل."
        );

      }

      throw new HttpsError(
        "internal",
        "تعذر إنشاء حساب الموظف."
      );

    }


    // -----------------------------------------
    // 6. إنشاء ملف الموظف في Firestore
    // -----------------------------------------

    try {

      await db
        .collection("users")
        .doc(newUser.uid)
        .set({

          uid:
            newUser.uid,

          email:
            email.trim(),

          name:
            name.trim(),

          role:
            "employee",

          active:
            true,

          permissions:
            permissions,

          createdAt:
            admin.firestore.FieldValue.serverTimestamp(),

          updatedAt:
            admin.firestore.FieldValue.serverTimestamp(),

          createdBy:
            request.auth.uid

        });

    } catch (error) {

      // إذا فشل إنشاء ملف Firestore
      // نحذف حساب Authentication حتى لا يبقى حساب ناقص

      try {

        await auth.deleteUser(
          newUser.uid
        );

      } catch (deleteError) {

        console.error(
          "Failed to rollback user:",
          deleteError
        );

      }

      console.error(
        "Failed to create Firestore profile:",
        error
      );

      throw new HttpsError(
        "internal",
        "تم إنشاء الحساب لكن حدث خطأ أثناء حفظ بيانات الموظف."
      );

    }


    // -----------------------------------------
    // 7. النتيجة
    // -----------------------------------------

    return {

      success:
        true,

      uid:
        newUser.uid,

      message:
        "تم إنشاء حساب الموظف بنجاح."

    };

  }
);