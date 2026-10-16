package com.foodgo_app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import com.foodgo_app.util.ImageUrlHelper;

import org.junit.Test;

public class ImageUrlHelperTest {

    @Test
    public void buildsFullUrlFromStoredFilename() {
        assertEquals(BuildConfig.API_BASE_URL + "uploads/pho.jpg",
                ImageUrlHelper.getImageUrl("pho.jpg"));
    }

    @Test
    public void keepsUrlsThatAreAlreadyAbsolute() {
        assertEquals("https://cdn.example.com/pho.jpg",
                ImageUrlHelper.getImageUrl("https://cdn.example.com/pho.jpg"));
    }

    @Test
    public void returnsNullWhenThereIsNoImage() {
        assertNull(ImageUrlHelper.getImageUrl(null));
        assertNull(ImageUrlHelper.getImageUrl(""));
    }
}
