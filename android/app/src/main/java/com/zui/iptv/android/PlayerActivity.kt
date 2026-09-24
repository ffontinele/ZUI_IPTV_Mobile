package com.zui.iptv.android

import android.app.Activity
import android.content.Intent
import android.media.AudioManager
import android.os.Bundle
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.getcapacitor.JSObject

class PlayerActivity : Activity() {
    private var player: ExoPlayer? = null
    private var audio: AudioManager? = null
    private var downX = 0f; private var downY = 0f; private var dragging = false
    private var baseVol = 0; private var baseBright = -1f
    private var indicator: TextView? = null

    companion object { var instance: PlayerActivity? = null }

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        instance = this
        try {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            audio = getSystemService(AUDIO_SERVICE) as AudioManager
            val w = resources.displayMetrics.widthPixels
            val h = resources.displayMetrics.heightPixels

            val root = FrameLayout(this)
            val playerView = PlayerView(this)
            playerView.controllerShowTimeoutMs = 3500
            root.addView(playerView, FrameLayout.LayoutParams(-1, -1))

            val title = TextView(this)
            title.text = intent.getStringExtra("title") ?: ""
            title.setPadding(48, 40, 48, 40)
            title.setTextColor(0xFFFFFFFF.toInt())
            title.textSize = 15f
            root.addView(title, FrameLayout.LayoutParams(-1, -2))

            val nav = LinearLayout(this)
            nav.orientation = LinearLayout.HORIZONTAL
            if (intent.getBooleanExtra("hasSeries", false)) {
                val btnPrev = TextView(this); btnPrev.text = " ⏮ "
                btnPrev.setTextColor(0xFFFFFFFF.toInt()); btnPrev.textSize = 20f
                btnPrev.setPadding(44, 22, 44, 22); btnPrev.setBackgroundColor(0x66000000)
                val btnNext = TextView(this); btnNext.text = " ⏭ "
                btnNext.setTextColor(0xFFFFFFFF.toInt()); btnNext.textSize = 20f
                btnNext.setPadding(44, 22, 44, 22); btnNext.setBackgroundColor(0x66000000)
                btnPrev.setOnClickListener { NativePlayerPlugin.instance?.emit("episodeNav", JSObject().put("dir", "prev")) }
                btnNext.setOnClickListener { NativePlayerPlugin.instance?.emit("episodeNav", JSObject().put("dir", "next")) }
                nav.addView(btnPrev); nav.addView(btnNext)
            }
            val nlp = FrameLayout.LayoutParams(-2, -2)
            nlp.gravity = Gravity.BOTTOM or Gravity.END
            root.addView(nav, nlp)

            val ind = TextView(this)
            ind.visibility = View.GONE
            ind.setTextColor(0xFFFFFFFF.toInt()); ind.textSize = 18f
            ind.setBackgroundColor(0xAA000000.toInt()); ind.setPadding(44, 26, 44, 26)
            val ilp = FrameLayout.LayoutParams(-2, -2); ilp.gravity = Gravity.CENTER
            root.addView(ind, ilp)
            indicator = ind

            setContentView(root)
            val p = ExoPlayer.Builder(this).build()
            player = p
            playerView.player = p
            p.setMediaItem(MediaItem.fromUri(intent.getStringExtra("url") ?: ""))
            p.prepare()
            val rs = intent.getLongExtra("resumeSec", 0)
            if (rs > 0) p.seekTo(rs * 1000)
            p.playWhenReady = true
        } catch (e: Exception) {
            setResult(RESULT_CANCELED, Intent().putExtra("error", e.message ?: "erro"))
            finish()
        }
    }

    fun switchUrl(url: String) {
        val p = player ?: return
        p.setMediaItem(MediaItem.fromUri(url))
        p.prepare()
        p.playWhenReady = true
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        gesture(ev)
        return super.dispatchTouchEvent(ev)
    }

    private fun gesture(ev: MotionEvent) {
        val w = resources.displayMetrics.widthPixels
        val h = resources.displayMetrics.heightPixels
        val maxVol = audio?.getStreamMaxVolume(AudioManager.STREAM_MUSIC) ?: 15
        when (ev.action) {
            MotionEvent.ACTION_DOWN -> {
                downX = ev.x; downY = ev.y; dragging = false
                baseVol = audio?.getStreamVolume(AudioManager.STREAM_MUSIC) ?: 0
                baseBright = window.attributes.screenBrightness
            }
            MotionEvent.ACTION_MOVE -> {
                val dy = downY - ev.y
                if (Math.abs(dy) > 60) dragging = true
                if (dragging) {
                    val frac = dy / (h * 0.6f)
                    if (downX > w / 2) {
                        val v = (baseVol + frac * maxVol).toInt().coerceIn(0, maxVol)
                        audio?.setStreamVolume(AudioManager.STREAM_MUSIC, v, 0)
                        indicator?.text = "🔊 $v/$maxVol"
                    } else {
                        val cur = if (baseBright < 0) 0.5f else baseBright
                        val br = (cur + frac).coerceIn(0.05f, 1f)
                        val wp = window.attributes; wp.screenBrightness = br; window.attributes = wp
                        indicator?.text = "☀️ ${(br * 100).toInt()}%"
                    }
                    indicator?.visibility = View.VISIBLE
                }
            }
            MotionEvent.ACTION_UP -> indicator?.postDelayed({ indicator?.visibility = View.GONE }, 700)
        }
    }

    override fun onDestroy() {
        val p = player
        if (p != null) {
            val pos = (p.currentPosition / 1000).coerceAtLeast(0)
            val dur = (p.duration / 1000).coerceAtLeast(0)
            setResult(RESULT_OK, Intent().putExtra("position", pos).putExtra("duration", dur))
            p.release()
            player = null
        }
        instance = null
        super.onDestroy()
    }
}
