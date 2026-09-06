plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "com.valen.cocinanuevo.webwrapper"
  compileSdk = 34

  defaultConfig {
    applicationId = "com.valen.cocinanuevo.webwrapper"
    minSdk = 24
    targetSdk = 34
    versionCode = 1
    versionName = "1.0"

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions { jvmTarget = "17" }

  buildFeatures {
    viewBinding = true
    buildConfig = true // FIX: genera BuildConfig (usado en MainActivity)
  }
}

/**
 * Copia automáticamente tu build web (dist/) a assets para que la APK lo incluya.
 * - Espera que Vite genere: <root>/dist
 * - Si no existe dist/, el task se salta (no falla el build).
 */
val syncWebAssets = tasks.register<Copy>("syncWebAssets") {
  val distDir = rootProject.file("dist")
  val assetsWebDir = file("$projectDir/src/main/assets/web")

  onlyIf { distDir.exists() && distDir.isDirectory }

  doFirst {
    if (assetsWebDir.exists()) assetsWebDir.deleteRecursively()
    assetsWebDir.mkdirs()
  }

  from(distDir)
  into(assetsWebDir)
}

tasks.named("preBuild") {
  dependsOn(syncWebAssets)
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.activity:activity-ktx:1.9.3")
  implementation("com.google.android.material:material:1.12.0")
  implementation("androidx.webkit:webkit:1.12.1")

  testImplementation("junit:junit:4.13.2")
  androidTestImplementation("androidx.test.ext:junit:1.2.1")
  androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
