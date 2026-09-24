package com.zui.iptv.android

import android.content.Intent
import androidx.activity.result.ActivityResult
import com.getcapacitor.ActivityCallback
import com.getcapacitor.CapacitorPlugin
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod

@CapacitorPlugin(name = "NativePlayer")
class NativePlayerPlugin : Plugin() {
    companion object { var instance: NativePlayerPlugin? = null }
    override fun load() { instance = this }
    fun emit(event: String, data: JSObject) { notifyListeners(event, data) }

    @PluginMethod
    fun play(call: PluginCall) {
        try {
            val intent = Intent(bridge.activity, PlayerActivity::class.java).apply {
                putExtra("url", call.getString("url") ?: "")
                putExtra("title", call.getString("title") ?: "")
                putExtra("resumeSec", (call.getDouble("resumeSec") ?: 0.0).toLong())
                putExtra("hasSeries", call.getBoolean("hasSeries") ?: false)
            }
            startActivityForResult(call, intent, "playerResult")
        } catch (e: Exception) {
            call.reject("player nativo indisponivel: " + e.message)
        }
    }

    @PluginMethod
    fun switchUrl(call: PluginCall) {
        PlayerActivity.instance?.switchUrl(call.getString("url") ?: "")
        call.resolve()
    }

    @ActivityCallback
    private fun playerResult(call: PluginCall?, result: ActivityResult) {
        val pos = result.resultData?.getLongExtra("position", 0) ?: 0
        val dur = result.resultData?.getLongExtra("duration", 0) ?: 0
        val ret = JSObject()
        ret.put("position", pos)
        ret.put("duration", dur)
        call?.resolve(ret)
    }
}
