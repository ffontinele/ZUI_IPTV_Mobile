package com.zui.iptv.android

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView

class SubtitleEngine(
    private val activity: Activity,
    private val root: FrameLayout,
    private val playerView: PlayerView
) {
    private val prefs = activity.getSharedPreferences("zui_subtitle_style", 0)

    private var positionTop = prefs.getBoolean("pos_top", false)
    private var colorIdx = prefs.getInt("color", 0)
    private var bold = prefs.getBoolean("bold", false)
    private var sizeIdx = prefs.getInt("size", 1)
    private var opacityIdx = prefs.getInt("opacity", 3)
    private var bgIdx = prefs.getInt("bg", 1)
    private var shadow = prefs.getBoolean("shadow", true)

    private var settingsOverlay: FrameLayout? = null

    val settingsOpen: Boolean get() = settingsOverlay != null

    companion object {
        private val COLORS = intArrayOf(
            Color.WHITE, Color.BLACK, Color.RED,
            0xFF4CD964.toInt(), Color.YELLOW, Color.CYAN
        )
        // Fracao da ALTURA da tela (padrao do ExoPlayer = 0.0533)
        private val SIZES = floatArrayOf(0.040f, 0.0533f, 0.070f, 0.090f)
        private val SIZE_NAMES = arrayOf("Pequeno", "Médio", "Grande", "Enorme")
        private val PREVIEW_SIZES = floatArrayOf(14f, 18f, 24f, 30f)
        private val OPACITY = floatArrayOf(0.25f, 0.5f, 0.75f, 1f)
        private val OPACITY_NAMES = arrayOf("25%", "50%", "75%", "100%")
        private val BG_NAMES = arrayOf("Sem fundo", "Translúcido", "Sólido")
        private const val PAD_BOTTOM = 0.08f
        private const val PAD_TOP = 0.85f
    }

    init {
        applyStyle()
    }

    private fun fgColor(): Int {
        val alpha = (OPACITY[opacityIdx] * 255).toInt()
        return (COLORS[colorIdx] and 0x00FFFFFF) or (alpha shl 24)
    }

    private fun bgColor(): Int = when (bgIdx) {
        0 -> Color.TRANSPARENT
        1 -> 0x66000000
        else -> 0xFF000000.toInt()
    }

    private fun currentStyle(): CaptionStyleCompat = CaptionStyleCompat(
        fgColor(),
        bgColor(),
        Color.TRANSPARENT,
        if (shadow) CaptionStyleCompat.EDGE_TYPE_DROP_SHADOW else CaptionStyleCompat.EDGE_TYPE_NONE,
        if (shadow) Color.BLACK else Color.TRANSPARENT,
        if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
    )

    private fun applyStyle() {
        val sv = playerView.subtitleView ?: return
        try {
            // Nosso estilo SEMPRE vence o estilo embutido do SSA/ASS/SRT
            sv.setApplyEmbeddedStyles(false)
            sv.setApplyEmbeddedFontSizes(false)
            sv.setStyle(currentStyle())
            sv.setFractionalTextSize(SIZES[sizeIdx])
            sv.setBottomPaddingFraction(if (positionTop) PAD_TOP else PAD_BOTTOM)
            (sv.layoutParams as? FrameLayout.LayoutParams)?.let { lp ->
                lp.gravity = if (positionTop) {
                    Gravity.TOP or Gravity.CENTER_HORIZONTAL
                } else {
                    Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                }
                sv.layoutParams = lp
            }
        } catch (_: Exception) { /* nunca crasha */ }
    }

    private fun save() {
        prefs.edit()
            .putBoolean("pos_top", positionTop)
            .putInt("color", colorIdx)
            .putBoolean("bold", bold)
            .putInt("size", sizeIdx)
            .putInt("opacity", opacityIdx)
            .putInt("bg", bgIdx)
            .putBoolean("shadow", shadow)
            .apply()
    }

    fun release() {
        settingsOverlay?.let { root.removeView(it) }
        settingsOverlay = null
    }

    // ---------------- tela de configuracoes ----------------
    fun openSettings() {
        if (settingsOverlay != null) return
        val ov = FrameLayout(activity)
        ov.setBackgroundColor(0x99000000.toInt())
        ov.setOnClickListener { closeSettings() }

        val card = LinearLayout(activity)
        card.orientation = LinearLayout.VERTICAL
        card.setBackgroundColor(0xE61A1A1A.toInt())
        card.setPadding(48, 36, 48, 36)
        card.setOnClickListener { }

        val header = LinearLayout(activity)
        header.orientation = LinearLayout.HORIZONTAL
        val title = TextView(activity)
        title.text = "Configurações de Legendas"
        title.setTextColor(0xFFFFFFFF.toInt())
        title.textSize = 20f
        title.layoutParams = LinearLayout.LayoutParams(0, -2, 1f)
        val close = TextView(activity)
        close.text = " \u2715 "
        close.setTextColor(0xFFFFFFFF.toInt())
        close.textSize = 20f
        close.setOnClickListener { closeSettings() }
        header.addView(title)
        header.addView(close)
        card.addView(header)

        val preview = TextView(activity)
        preview.text = "Texto de exemplo da legenda"
        preview.gravity = Gravity.CENTER
        preview.setPadding(24, 14, 24, 14)
        val plp = LinearLayout.LayoutParams(-2, -2)
        plp.gravity = Gravity.CENTER_HORIZONTAL
        plp.topMargin = 18
        plp.bottomMargin = 18
        card.addView(preview, plp)

        fun stylePreview() {
            preview.setTextColor(fgColor())
            preview.setBackgroundColor(bgColor())
            preview.textSize = PREVIEW_SIZES[sizeIdx]
            preview.typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            if (shadow) preview.setShadowLayer(6f, 2f, 2f, Color.BLACK)
        }
        stylePreview()

        val scroll = ScrollView(activity)
        val list = LinearLayout(activity)
        list.orientation = LinearLayout.VERTICAL

        fun refresh() {
            save()
            applyStyle()
            stylePreview()
        }

        val rowPos = TextView(activity)
        val rowBold = TextView(activity)
        val rowSize = TextView(activity)
        val rowOpacity = TextView(activity)
        val rowBg = TextView(activity)
        val rowShadow = TextView(activity)

        fun labels() {
            rowPos.text = "Posição: " + if (positionTop) "Superior" else "Inferior"
            rowBold.text = "Negrito: " + if (bold) "Ativado" else "Desativado"
            rowSize.text = "Tamanho: " + SIZE_NAMES[sizeIdx]
            rowOpacity.text = "Opacidade: " + OPACITY_NAMES[opacityIdx]
            rowBg.text = "Fundo: " + BG_NAMES[bgIdx]
            rowShadow.text = "Sombra: " + if (shadow) "Ativada" else "Desativada"
        }

        fun rowStyle(tv: TextView) {
            tv.setTextColor(0xFFFFFFFF.toInt())
            tv.textSize = 17f
            tv.setPadding(16, 20, 16, 20)
        }

        rowPos.setOnClickListener { positionTop = !positionTop; labels(); refresh() }
        rowBold.setOnClickListener { bold = !bold; labels(); refresh() }
        rowSize.setOnClickListener { sizeIdx = (sizeIdx + 1) % SIZES.size; labels(); refresh() }
        rowOpacity.setOnClickListener { opacityIdx = (opacityIdx + 1) % OPACITY.size; labels(); refresh() }
        rowBg.setOnClickListener { bgIdx = (bgIdx + 1) % BG_NAMES.size; labels(); refresh() }
        rowShadow.setOnClickListener { shadow = !shadow; labels(); refresh() }
        listOf(rowPos, rowBold, rowSize, rowOpacity, rowBg, rowShadow).forEach { rowStyle(it); list.addView(it) }

        val colorLabel = TextView(activity)
        colorLabel.text = "Cor do texto:"
        rowStyle(colorLabel)
        list.addView(colorLabel)

        val swatchBar = LinearLayout(activity)
        swatchBar.orientation = LinearLayout.HORIZONTAL
        fun rebuildSwatches() {
            swatchBar.removeAllViews()
            for (i in COLORS.indices) {
                val sw = TextView(activity)
                sw.gravity = Gravity.CENTER
                sw.text = if (i == colorIdx) "\u2713" else ""
                sw.setTextColor(if (i == 0 || i == 4 || i == 5) Color.BLACK else Color.WHITE)
                sw.setBackgroundColor(COLORS[i])
                val slp = LinearLayout.LayoutParams(84, 84)
                slp.setMargins(10, 10, 10, 10)
                sw.setOnClickListener { colorIdx = i; labels(); rebuildSwatches(); refresh() }
                swatchBar.addView(sw, slp)
            }
        }
        rebuildSwatches()
        list.addView(swatchBar)

        labels()
        scroll.addView(list)
        card.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))

        val w = activity.resources.displayMetrics.widthPixels
        val h = activity.resources.displayMetrics.heightPixels
        val clp = FrameLayout.LayoutParams((w * 0.8f).toInt(), (h * 0.8f).toInt())
        clp.gravity = Gravity.CENTER
        ov.addView(card, clp)
        root.addView(ov, FrameLayout.LayoutParams(-1, -1))
        settingsOverlay = ov
    }

    fun closeSettings() {
        settingsOverlay?.let { root.removeView(it) }
        settingsOverlay = null
    }
}
