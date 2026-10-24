using System;
using System.Collections;
using System.IO;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

public class MaxBridgePlayModeTest
{
    private static void Capture(Camera camera, RenderTexture render, Texture2D image, string path)
    {
        camera.targetTexture = render;
        camera.Render();
        var previous = RenderTexture.active;
        RenderTexture.active = render;
        image.ReadPixels(new Rect(0, 0, 1280, 720), 0, 0);
        image.Apply();
        File.WriteAllBytes(path, image.EncodeToPNG());
        RenderTexture.active = previous;
    }

    [UnityTest]
    public IEnumerator BrightTalesCommandBlinksApprovedMax()
    {
        SceneManager.LoadScene("MaxBridgeDemo");
        yield return null;
        var max = GameObject.Find("Max (approved original artwork)");
        Assert.IsNotNull(max);
        var camera = Camera.main;
        Assert.IsNotNull(camera);
        var eyes = max.transform.Find("Brightling Life V2 eyelids").GetComponent<SpriteRenderer>();
        Assert.IsFalse(eyes.enabled);
        var root = Directory.GetParent(Application.dataPath).FullName;
        var frames = Path.Combine(root, "play-video-frames");
        Directory.CreateDirectory(frames);
        var render = new RenderTexture(1280, 720, 24, RenderTextureFormat.ARGB32);
        var image = new Texture2D(1280, 720, TextureFormat.RGBA32, false);
        Capture(camera, render, image, Path.Combine(root, "test-play-open.png"));
        File.WriteAllText(Path.Combine(root, "test-play-ready.txt"), "ready");
        var start = Time.realtimeSinceStartup;
        var reopenedAt = -1f;
        var closed = false;
        var frame = 0;
        while (Time.realtimeSinceStartup - start < 20 && (reopenedAt < 0 || Time.realtimeSinceStartup - reopenedAt < 1.6f))
        {
            yield return null;
            Capture(camera, render, image, Path.Combine(frames, "frame-" + frame.ToString("D4") + ".png"));
            if (eyes.enabled && !closed)
            {
                closed = true;
                File.WriteAllText(Path.Combine(root, "test-play-blink-frame.txt"), frame.ToString());
                Capture(camera, render, image, Path.Combine(root, "test-play-closed.png"));
            }
            if (closed && !eyes.enabled && reopenedAt < 0)
            {
                reopenedAt = Time.realtimeSinceStartup;
                Capture(camera, render, image, Path.Combine(root, "test-play-reopened.png"));
            }
            frame++;
        }
        camera.targetTexture = null;
        UnityEngine.Object.Destroy(render);
        UnityEngine.Object.Destroy(image);
        Assert.IsTrue(closed, "No blink command reached Max in Play mode");
        Assert.IsTrue(reopenedAt >= 0, "Max did not reopen his eyes in Play mode");
        File.WriteAllText(Path.Combine(root, "test-play-frame-count.txt"), frame.ToString());
    }
}
