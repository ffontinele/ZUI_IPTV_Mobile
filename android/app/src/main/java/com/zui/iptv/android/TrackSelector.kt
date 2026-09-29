package com.zui.iptv.android

import android.app.Activity
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.media3.common.C
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.exoplayer.ExoPlayer

class TrackSelector(
    private val activity: Activity,
    private val root: FrameLayout,
    private val playerProvider: () -> ExoPlayer?
) {
    var panelOpen = false
        private set

    private var btnAudio: TextView? = null
    private var btnSub: TextView? = null
    private var overlay: FrameLayout? = null
    private var audioGroups: List<Tracks.Group> = emptyList()
    private var textGroups: List<Tracks.Group> = emptyList()

    fun attachTopButtons() {
        val bar = LinearLayout(activity)
        bar.orientation = LinearLayout.HORIZONTAL

        btnAudio = topButton(" Aa ") { openPanel(false) }
        btnSub = topButton(" CC ") { openPanel(true) }
        btnAudio?.visibility = View.GONE
        btnSub?.visibility = View.GONE

        bar.addView(btnAudio)
        bar.addView(btnSub)

        val lp = FrameLayout.LayoutParams(-2, -2)
        lp.gravity = Gravity.TOP or Gravity.END
        root.addView(bar, lp)
    }

    private fun topButton(label: String, onClick: () -> Unit): TextView {
        val tv = TextView(activity)
        tv.text = label
        tv.setTextColor(0xFFFFFFFF.toInt())
        tv.textSize = 16f
        tv.setPadding(28, 18, 28, 18)
        tv.setBackgroundColor(0x66000000)
        tv.setOnClickListener { onClick() }
        return tv
    }

    fun onTracksChanged(tracks: Tracks) {
        audioGroups = tracks.groups.filter { it.type == C.TRACK_TYPE_AUDIO }
        textGroups = tracks.groups.filter { it.type == C.TRACK_TYPE_TEXT }
        btnAudio?.visibility = if (audioGroups.isNotEmpty()) View.VISIBLE else View.GONE
        btnSub?.visibility = if (textGroups.isNotEmpty()) View.VISIBLE else View.GONE
        if (panelOpen) closePanel()
    }

    fun openPanel(forSubtitles: Boolean) {
        if (panelOpen) return
        val groups = if (forSubtitles) textGroups else audioGroups
        if (groups.isEmpty()) return
        val type = if (forSubtitles) C.TRACK_TYPE_TEXT else C.TRACK_TYPE_AUDIO

        val ov = FrameLayout(activity)
        ov.setBackgroundColor(0x99000000.toInt())
        ov.setOnClickListener { closePanel() }

        val card = LinearLayout(activity)
        card.orientation = LinearLayout.VERTICAL
        card.setBackgroundColor(0xE61A1A1A.toInt())
        card.setPadding(48, 40, 48, 40)
        card.setOnClickListener { /* consome toque dentro */ }

        val header = LinearLayout(activity)
        header.orientation = LinearLayout.HORIZONTAL
        val title = TextView(activity)
        title.text = if (forSubtitles) "Faixas de Legendas" else "Faixas de Áudio"
        title.setTextColor(0xFFFFFFFF.toInt())
        title.textSize = 20f
        title.layoutParams = LinearLayout.LayoutParams(0, -2, 1f)
        val close = TextView(activity)
        close.text = " \u2715 "
        close.setTextColor(0xFFFFFFFF.toInt())
        close.textSize = 20f
        close.setOnClickListener { closePanel() }
        header.addView(title)
        header.addView(close)
        card.addView(header)

        val scroll = ScrollView(activity)
        val list = LinearLayout(activity)
        list.orientation = LinearLayout.VERTICAL

        val disabled = playerProvider()?.trackSelectionParameters
            ?.disabledTrackTypes?.contains(type) == true

        list.addView(optionRow("Disable", disabled) {
            setDisabled(type, true)
            closePanel()
        })

        groups.forEach { group ->
            for (i in 0 until group.length) {
                val selected = group.isTrackSelected(i)
                list.addView(optionRow(trackLabel(group, i), selected) {
                    selectTrack(group, i, type)
                    closePanel()
                })
            }
        }

        scroll.addView(list)
        card.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))

        val w = activity.resources.displayMetrics.widthPixels
        val h = activity.resources.displayMetrics.heightPixels
        val clp = FrameLayout.LayoutParams((w * 0.8f).toInt(), (h * 0.7f).toInt())
        clp.gravity = Gravity.CENTER
        ov.addView(card, clp)

        root.addView(ov, FrameLayout.LayoutParams(-1, -1))
        overlay = ov
        panelOpen = true
    }

    fun closePanel() {
        overlay?.let { root.removeView(it) }
        overlay = null
        panelOpen = false
    }

    private fun optionRow(label: String, selected: Boolean, onClick: () -> Unit): TextView {
        val tv = TextView(activity)
        tv.text = (if (selected) "\u25cf  " else "\u25cb  ") + label
        tv.setTextColor(0xFFFFFFFF.toInt())
        tv.textSize = 17f
        tv.setPadding(16, 22, 16, 22)
        tv.setOnClickListener { onClick() }
        return tv
    }

    private fun trackLabel(group: Tracks.Group, index: Int): String {
        val f = group.getTrackFormat(index)
        val lang = f.language?.takeIf { it.isNotBlank() }?.let { " [$it]" } ?: ""
        val name = f.label?.takeIf { it.isNotBlank() } ?: "Track ${index + 1}"
        return name + lang
    }

    private fun selectTrack(group: Tracks.Group, index: Int, type: Int) {
        val p = playerProvider() ?: return
        val override = TrackSelectionOverride(group.mediaTrackGroup, listOf(index))
        p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
            .setTrackTypeDisabled(type, false)
            .clearOverridesOfType(type)
            .addOverride(override)
            .build()
    }

    private fun setDisabled(type: Int, disabled: Boolean) {
        val p = playerProvider() ?: return
        p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
            .setTrackTypeDisabled(type, disabled)
            .build()
    }
}
