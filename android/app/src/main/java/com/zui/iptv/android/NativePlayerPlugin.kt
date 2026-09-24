package com.zui.iptv.android

import android.app.Activity
import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NativePlayer")
class NativePlayerPlugin : Plugin() {
    companion object {
        var instance: NativePlayerPlugin? = null
    }

    override fun load() {
        super.load()
        instance = this
    }

    fun emit(event: String, data: JSObject) {
        notifyListeners(event, data)
    }

    @PluginMethod
    fun play(call: PluginCall) {
        try {
            val intent = Intent(activity, PlayerActivity::class.java).apply {
                putExtra("url", call.getString("url") ?: "")
                putExtra("title", call.getString("title") ?: "")
                putExtra("resumeSec", (call.getDouble("resumeSec") ?: 0.0).toLong())
                putExtra("hasSeries", call.getBoolean("hasSeries") ?: false)
            }
            startActivityForResult(call, intent, "onPlayerResult")
        } catch (e: Exception) {
            call.reject("player nativo indisponivel: " + (e.message ?: "erro"))
        }
    }

    @PluginMethod
    fun switchUrl(call: PluginCall) {
        PlayerActivity.instance?.switchUrl(call.getString("url") ?: "")
        call.resolve()
    }

    @ActivityCallback
    fun onPlayerResult(call: PluginCall?, result: androidx.activity.result.ActivityResult) {
        val intent = result.data
        val pos = intent?.getLongExtra("position", 0) ?: 0
        val dur = intent?.getLongExtra("duration", 0) ?: 0
        val err = intent?.getStringExtra("error")
        val ret = JSObject()
        ret.put("position", pos)
        ret.put("duration", dur)
        if (err != null) ret.put("error", err)
        call?.resolve(ret)
    }
}
