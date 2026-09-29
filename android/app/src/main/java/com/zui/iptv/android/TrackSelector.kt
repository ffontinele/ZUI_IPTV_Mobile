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
    private val openSettings: () -> Unit = {},
    private val playerProvider: () -> ExoPlayer?
) {
    var panelOpen = false
        private set

    private var btnAudio: TextView? = null
    private var btnSub: TextView? = null
    private var overlay: FrameLayout? = null
    private var audioGroups: List<Tracks.Group> = emptyList()
    private var textGroups: List<Tracks.Group> = emptyList()
    private var pendingAutoSelect = true

    companion object {
        private const val PREFS = "zui_track_prefs"
        private const val KEY_AUDIO_LANG = "audio_lang"
        private const val KEY_SUB_LANG = "sub_lang"

        private val LANG_NAMES = mapOf(
            "en" to "English", "en-us" to "English (US)", "en-gb" to "English (UK)",
            "ja" to "Japanese", "pt" to "Portuguese",
            "pt-br" to "Portuguese (Brazil)", "pt-pt" to "Portuguese (Portugal)",
            "es" to "Spanish", "es-419" to "Spanish (Latin America)", "es-mx" to "Spanish (Mexico)",
            "fr" to "French", "fr-ca" to "French (Canada)", "de" to "German", "it" to "Italian",
            "ru" to "Russian", "ko" to "Korean", "zh" to "Chinese",
            "zh-cn" to "Chinese (Simplified)", "zh-tw" to "Chinese (Traditional)",
            "ar" to "Arabic", "tr" to "Turkish", "pl" to "Polish", "ms" to "Malay",
            "id" to "Indonesian", "th" to "Thai", "vi" to "Vietnamese", "hi" to "Hindi",
            "nl" to "Dutch", "sv" to "Swedish", "no" to "Norwegian", "da" to "Danish",
            "fi" to "Finnish", "el" to "Greek", "he" to "Hebrew", "fa" to "Persian",
            "uk" to "Ukrainian", "cs" to "Czech", "hu" to "Hungarian", "ro" to "Romanian",
            "bg" to "Bulgarian", "hr" to "Croatian", "sr" to "Serbian", "sk" to "Slovak",
            "ca" to "Catalan", "fil" to "Filipino", "bn" to "Bengali", "ta" to "Tamil",
            "te" to "Telugu", "ur" to "Urdu", "sw" to "Swahili", "af" to "Afrikaans",
            "sq" to "Albanian", "et" to "Estonian", "lv" to "Latvian", "lt" to "Lithuanian",
            "sl" to "Slovenian", "mk" to "Macedonian", "is" to "Icelandic"
        )

        // ISO 639-2 (3 letras, comum em MKV) -> ISO 639-1 (2 letras)
        private val ISO3 = mapOf(
            "por" to "pt", "eng" to "en", "spa" to "es", "fre" to "fr", "fra" to "fr",
            "ger" to "de", "deu" to "de", "jpn" to "ja", "kor" to "ko", "rus" to "ru",
            "ita" to "it", "chi" to "zh", "zho" to "zh", "pol" to "pl", "may" to "ms",
            "msa" to "ms", "ind" to "id", "tha" to "th", "vie" to "vi", "hin" to "hi",
            "tur" to "tr", "ara" to "ar", "ukr" to "uk", "cze" to "cs", "ces" to "cs",
            "hun" to "hu", "ron" to "ro", "rum" to "ro", "bul" to "bg", "hrv" to "hr",
            "srp" to "sr", "slk" to "sk", "slo" to "sl", "cat" to "ca", "nld" to "nl",
            "dut" to "nl", "swe" to "sv", "nor" to "no", "dan" to "da", "fin" to "fi",
            "ell" to "el", "gre" to "el", "heb" to "he", "fas" to "fa", "per" to "fa",
            "tgl" to "fil", "fil" to "fil"
        )

        private fun langName(code: String): String? {
            LANG_NAMES[code]?.let { return it }
            val base = code.substringBefore('-')
            val region = code.substringAfter('-', "").uppercase()
            val baseName = LANG_NAMES[base] ?: return null
            return if (region.isEmpty()) baseName else "$baseName ($region)"
        }

        /** Normaliza pt-BR / pt_BR / por / pt-br -> "pt-br" */
        private fun langKey(lang: String?): String? {
            val l = lang?.lowercase()?.replace("_", "-") ?: return null
            val base = l.substringBefore('-')
            val two = ISO3[base] ?: base
            val region = l.substringAfter('-', "")
            return if (region.isEmpty()) two else "$two-$region"
        }

        /** Prioridade: pt-br (3) > pt (2) > qualquer pt-* (1). Generico: exato (2) > regiao (1). */
        private fun score(key: String?, wanted: String): Int {
            if (key == null) return -1
            return if (wanted == "pt") when {
                key == "pt-br" -> 3
                key == "pt" -> 2
                key.startsWith("pt-") -> 1
                else -> -1
            } else when {
                key == wanted -> 2
                key.startsWith("$wanted-") -> 1
                else -> -1
            }
        }
    }

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

    fun noteMediaChanged() {
        pendingAutoSelect = true
    }

    fun onTracksChanged(tracks: Tracks) {
        audioGroups = tracks.groups.filter { it.type == C.TRACK_TYPE_AUDIO }
        textGroups = tracks.groups.filter { it.type == C.TRACK_TYPE_TEXT }
        btnAudio?.visibility = if (audioGroups.isNotEmpty()) View.VISIBLE else View.GONE
        btnSub?.visibility = if (textGroups.isNotEmpty()) View.VISIBLE else View.GONE
        if (panelOpen) closePanel()
        if (pendingAutoSelect && (audioGroups.isNotEmpty() || textGroups.isNotEmpty())) {
            pendingAutoSelect = false
            applyPreferences()
        }
    }

    // ---------- auto-selecao por preferencia ----------
    private fun applyPreferences() {
        val prefs = activity.getSharedPreferences(PREFS, 0)

        when (val a = prefs.getString(KEY_AUDIO_LANG, "pt")) {
            "none" -> setDisabled(C.TRACK_TYPE_AUDIO, true)
            else -> selectPreferred(audioGroups, C.TRACK_TYPE_AUDIO, a!!)
            // sem PT no audio: mantem o default do player (audio original)
        }

        when (val s = prefs.getString(KEY_SUB_LANG, "pt")) {
            "none" -> setDisabled(C.TRACK_TYPE_TEXT, true)
            else -> if (!selectPreferred(textGroups, C.TRACK_TYPE_TEXT, s!!)) {
                setDisabled(C.TRACK_TYPE_TEXT, true) // sem PT: legenda desligada
            }
        }
    }

    private fun selectPreferred(groups: List<Tracks.Group>, type: Int, wanted: String): Boolean {
        val p = playerProvider() ?: return false
        var bestScore = 0
        var bestGroup: Tracks.Group? = null
        var bestIndex = -1
        groups.forEach { group ->
            for (i in 0 until group.length) {
                val key = langKey(group.getTrackFormat(i).language)
                val sc = score(key, wanted)
                if (sc > bestScore) {
                    bestScore = sc
                    bestGroup = group
                    bestIndex = i
                }
            }
        }
        val g = bestGroup ?: return false
        selectTrack(g, bestIndex, type)
        return true
    }

    private fun savePref(type: Int, value: String) {
        val key = if (type == C.TRACK_TYPE_AUDIO) KEY_AUDIO_LANG else KEY_SUB_LANG
        activity.getSharedPreferences(PREFS, 0).edit().putString(key, value).apply()
    }

    // ---------- painel ----------
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
        if (forSubtitles) {
            val gear = TextView(activity)
            gear.text = " \u2699 "
            gear.setTextColor(0xFFFFFFFF.toInt())
            gear.textSize = 20f
            gear.setPadding(8, 0, 24, 0)
            gear.setOnClickListener { closePanel(); openSettings() }
            header.addView(gear)
        }
        header.addView(close)
        card.addView(header)

        val scroll = ScrollView(activity)
        val list = LinearLayout(activity)
        list.orientation = LinearLayout.VERTICAL

        val disabled = playerProvider()?.trackSelectionParameters
            ?.disabledTrackTypes?.contains(type) == true

        val ptSelected = groups.any { g ->
            (0 until g.length).any { i ->
                g.isTrackSelected(i) && score(langKey(g.getTrackFormat(i).language), "pt") > 0
            }
        }

        list.addView(optionRow("★  Padrão (Português)", ptSelected) {
            if (selectPreferred(groups, type, "pt")) {
                savePref(type, "pt")
                closePanel()
            } else {
                android.widget.Toast.makeText(
                    activity,
                    "Português não encontrado neste vídeo",
                    android.widget.Toast.LENGTH_SHORT
                ).show()
            }
        })

        list.addView(optionRow("Disable", disabled) {
            setDisabled(type, true)
            savePref(type, "none")
            closePanel()
        })

        val labels = buildLabels(groups, forSubtitles)
        groups.forEachIndexed { gi, group ->
            for (i in 0 until group.length) {
                val selected = group.isTrackSelected(i)
                list.addView(optionRow(labels[gi][i], selected) {
                    selectTrack(group, i, type)
                    savePref(type, langKey(group.getTrackFormat(i).language) ?: "und")
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

    /** Nome padronizado: label do arquivo > traducao do idioma > fallback. Repetidos ganham numero. */
    private fun buildLabels(groups: List<Tracks.Group>, forSubtitles: Boolean): List<List<String>> {
        val counts = mutableMapOf<String, Int>()
        return groups.map { group ->
            (0 until group.length).map { i ->
                val f = group.getTrackFormat(i)
                val lang = f.language?.takeIf { it.isNotBlank() && it != "und" }?.lowercase()
                val langName = lang?.let { langName(it) }
                val fallback = if (forSubtitles) "Legenda" else "Áudio"
                var base = f.label?.takeIf { it.isNotBlank() } ?: langName ?: fallback
                val key = base.lowercase()
                val n = (counts[key] ?: 0) + 1
                counts[key] = n
                if (n > 1) base = "$base $n"
                base + (lang?.let { " [$it]" } ?: "")
            }
        }
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
