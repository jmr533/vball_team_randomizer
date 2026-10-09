package com.vballteamrandomizer.app;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeTheme")
public class NativeThemePlugin extends Plugin {
    // Match the web canvas tokens in src/index.css (--canvas, light and dark).
    private static final int DARK_SYSTEM_BAR_COLOR = Color.rgb(12, 26, 36);
    private static final int LIGHT_SYSTEM_BAR_COLOR = Color.rgb(244, 233, 212);

    @PluginMethod
    public void setTheme(PluginCall call) {
        boolean isDark = "dark".equals(call.getString("theme", "light"));

        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            int color = isDark ? DARK_SYSTEM_BAR_COLOR : LIGHT_SYSTEM_BAR_COLOR;

            window.setStatusBarColor(color);
            window.setNavigationBarColor(color);
            window.getDecorView().setBackgroundColor(color);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                window.setNavigationBarDividerColor(color);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = window.getInsetsController();

                if (controller != null) {
                    int lightAppearance = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    controller.setSystemBarsAppearance(isDark ? 0 : lightAppearance, lightAppearance);
                }
            } else {
                int flags = window.getDecorView().getSystemUiVisibility();
                flags = isDark
                    ? flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                    : flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    flags = isDark
                        ? flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                        : flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }

                window.getDecorView().setSystemUiVisibility(flags);
            }

            call.resolve(new JSObject());
        });
    }
}
