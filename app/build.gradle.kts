import java.net.URI

plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.foodgo_app"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.foodgo_app"
        minSdk = 24
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
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
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

tasks.configureEach {
    if (name == "preReleaseBuild") {
        doFirst {
            require(providers.gradleProperty("FOODGO_API_BASE_URL").isPresent) {
                "Set -PFOODGO_API_BASE_URL=https://your-api-host/ before building release"
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
    testImplementation(libs.junit)
}
