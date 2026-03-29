package com.valen.cocinanuevo.webwrapper

import android.Manifest
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.util.*

class MainActivity : AppCompatActivity() {

    // ✅ ESTO ES LO QUE TE FALTABA: Las constantes para las alarmas
    companion object {
        const val EXTRA_ORDER_ID = "EXTRA_ORDER_ID"
        const val EXTRA_TITLE = "EXTRA_TITLE"
        const val EXTRA_BODY = "EXTRA_BODY"
        const val EXTRA_TRIGGER_AT = "EXTRA_TRIGGER_AT"
    }

    private var myWebView: WebView? = null
    private var mUploadMessage: ValueCallback<Array<Uri>>? = null
    private var cameraImageUri: Uri? = null

    private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (mUploadMessage == null) return@registerForActivityResult
        val results = if (result.resultCode == RESULT_OK) {
            val data: Intent? = result.data
            if (data?.data != null) arrayOf(data.data!!)
            else if (cameraImageUri != null) arrayOf(cameraImageUri!!)
            else null
        } else null
        mUploadMessage?.onReceiveValue(results)
        mUploadMessage = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // 🛡️ ESCUDO TOTAL: Fondo oscuro inmediato (Slate-950)
        window.decorView.setBackgroundColor(Color.parseColor("#020617"))

        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        updateStatusBarColor()
        checkPermissions()

        myWebView = findViewById(R.id.webView)

        // 🛡️ WEBVIEW OSCURO
        myWebView?.setBackgroundColor(Color.parseColor("#020617"))

        val webSettings = myWebView?.settings
        if (webSettings != null) {
            webSettings.javaScriptEnabled = true
            webSettings.domStorageEnabled = true
            webSettings.cacheMode = WebSettings.LOAD_NO_CACHE
            webSettings.allowFileAccess = true
            webSettings.allowContentAccess = true
            webSettings.databaseEnabled = true
            webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        myWebView?.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                myWebView?.setBackgroundColor(Color.parseColor("#020617"))
            }
        }

        myWebView?.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(webView: WebView?, filePathCallback: ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                mUploadMessage = filePathCallback
                val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                try {
                    val photoFile = createImageFile()
                    cameraImageUri = FileProvider.getUriForFile(this@MainActivity, "${packageName}.fileprovider", photoFile)
                    takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri)
                } catch (e: Exception) {}

                val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }
                val chooser = Intent(Intent.ACTION_CHOOSER).apply {
                    putExtra(Intent.EXTRA_INTENT, contentSelectionIntent)
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(takePictureIntent))
                }
                fileChooserLauncher.launch(chooser)
                return true
            }
        }

        // Cargamos v=7 para refrescar todo el diseño de píldoras y Rack/Nivel
        myWebView?.loadUrl("https://lextrim.github.io/unico-web/?v=7")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (myWebView?.canGoBack() == true) myWebView?.goBack() else finish()
            }
        })
    }

    private fun updateStatusBarColor() {
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.statusBarColor = Color.parseColor("#0f172a")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            window.decorView.systemUiVisibility = 0
        }
    }

    private fun checkPermissions() {
        val permissions = mutableListOf(Manifest.permission.CAMERA)
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2) {
            permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
        val needed = permissions.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (needed.isNotEmpty()) ActivityCompat.requestPermissions(this, needed.toTypedArray(), 100)
    }

    private fun createImageFile(): File {
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile("IMG_${System.currentTimeMillis()}_", ".jpg", storageDir)
    }
}