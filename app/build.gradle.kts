import java.net.URI

plugins {
    alias(libs.plugins.android.application)
}

// Firebase Crashlytics chi bat khi co app/google-services.json (tai tu Firebase
// Console, KHONG commit - xem .gitignore; CI release ghi file nay tu secret).
// Khong co file thi build van chay, CrashReporter thanh no-op.
val firebaseConfigured = file("google-services.json").exists()
if (firebaseConfigured) {
    apply(plugin = "com.google.gms.google-services")
    apply(plugin = "com.google.firebase.crashlytics")
}

// Version: CI truyen -PFOODGO_VERSION_CODE (so tang dan, vd github.run_number)
// va -PFOODGO_VERSION_NAME (lay tu tag v1.2.3). Google Play tu choi ban moi co
// versionCode khong lon hon ban truoc.
val appVersionCode = providers.gradleProperty("FOODGO_VERSION_CODE").orElse("1").get().toInt()
val appVersionName = providers.gradleProperty("FOODGO_VERSION_NAME").orElse("1.0.0-dev").get()

// Ky ban release: doc tu bien moi truong (CI secret) hoac ~/.gradle/gradle.properties.
// Keystore va mat khau KHONG bao gio nam trong repo.
fun signingValue(name: String) =
    providers.gradleProperty(name).orElse(providers.environmentVariable(name))
val keystoreFile = signingValue("FOODGO_KEYSTORE_FILE")
val keystorePassword = signingValue("FOODGO_KEYSTORE_PASSWORD")
val signingKeyAlias = signingValue("FOODGO_KEY_ALIAS")
val signingKeyPassword = signingValue("FOODGO_KEY_PASSWORD")
val releaseSigningConfigured = keystoreFile.isPresent && keystorePassword.isPresent
        && signingKeyAlias.isPresent && signingKeyPassword.isPresent

android {
    namespace = "com.foodgo_app"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.foodgo_app"
        minSdk = 24
        targetSdk = 37
        versionCode = appVersionCode
        versionName = appVersionName
    }

    signingConfigs {
        if (releaseSigningConfigured) {
            create("release") {
                storeFile = file(keystoreFile.get())
                storePassword = keystorePassword.get()
                keyAlias = signingKeyAlias.get()
                keyPassword = signingKeyPassword.get()
            }
        }
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:5000/\"")
        }
        release {
            val apiUrl = providers.gradleProperty("FOODGO_API_BASE_URL")
                .orElse("https://example.invalid/").get()
            val parsedUrl = URI(apiUrl)
            require(parsedUrl.scheme == "https" && !parsedUrl.host.isNullOrEmpty()
                    && parsedUrl.userInfo == null && parsedUrl.query == null
                    && parsedUrl.fragment == null && apiUrl.endsWith("/")) {
                "FOODGO_API_BASE_URL must be an HTTPS URL with a host and trailing /"
            }
            buildConfigField("String", "API_BASE_URL", "\"$apiUrl\"")
            optimization {
                enable = true
            }
            if (releaseSigningConfigured) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles("proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

val apiBaseUrlProperty = providers.gradleProperty("FOODGO_API_BASE_URL")
// -PFOODGO_REQUIRE_SIGNING=true (CI release): thieu thong tin ky thi dung build
// thay vi lang le tao ra file chua ky khong cai/upload duoc
val requireSigning = providers.gradleProperty("FOODGO_REQUIRE_SIGNING").orElse("false").get().toBoolean()

tasks.configureEach {
    if (name == "preReleaseBuild") {
        // Doc property o configuration time va chi bat bien Boolean vao doFirst:
        // tham chieu truc tiep provider/script trong doFirst se pha configuration cache
        val hasApiBaseUrl = apiBaseUrlProperty.isPresent
        val signed = releaseSigningConfigured
        val mustSign = requireSigning
        doFirst {
            require(hasApiBaseUrl) {
                "Set -PFOODGO_API_BASE_URL=https://your-api-host/ before building release"
            }
            require(signed || !mustSign) {
                "Release signing required: set FOODGO_KEYSTORE_FILE, FOODGO_KEYSTORE_PASSWORD, FOODGO_KEY_ALIAS, FOODGO_KEY_PASSWORD"
            }
            if (!signed) {
                logger.warn("FOODGO: ban release CHUA KY (thieu FOODGO_KEYSTORE_*). Khong cai/upload duoc len Google Play.")
            }
        }
    }
}

dependencies {
    implementation(libs.activity.ktx)
    implementation(libs.appcompat)
    implementation(libs.constraintlayout)
    implementation(libs.material)
    implementation(libs.retrofit.core)
    implementation(libs.retrofit.gson)
    implementation(libs.okhttp.core)
    implementation(libs.okhttp.logging)
    implementation(libs.glide.core)
    implementation(libs.lifecycle.viewmodel)
    implementation(libs.lifecycle.livedata)
    implementation(libs.recyclerview)
    implementation(libs.swiperefreshlayout)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.crashlytics)
    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
}
