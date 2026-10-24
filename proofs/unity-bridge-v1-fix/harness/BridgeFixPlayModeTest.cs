using System;
using System.Collections;
using System.IO;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

// Runs only in a disposable project copy with the real MaxBridgeDemo scene.
public sealed class BridgeFixPlayModeTest
{
    private static void Capture(Camera camera, string path)
    {
        var render = new RenderTexture(1280, 720, 24, RenderTextureFormat.ARGB32);
        var image = new Texture2D(1280, 720, TextureFormat.RGBA32, false);
        camera.targetTexture = render;
        camera.Render();
        var previous = RenderTexture.active;
        RenderTexture.active = render;
        image.ReadPixels(new Rect(0, 0, 1280, 720), 0, 0);
        image.Apply();
        File.WriteAllBytes(path, image.EncodeToPNG());
        RenderTexture.active = previous;
        camera.targetTexture = null;
        UnityEngine.Object.Destroy(render);
        UnityEngine.Object.Destroy(image);
    }

    [UnityTest]
    public IEnumerator RealSceneHandlesTwoBlinkCommands()
    {
        SceneManager.LoadScene("MaxBridgeDemo");
        yield return null;
        var receiver = GameObject.Find("BrightTales Bridge V0 receiver");
        var max = GameObject.Find("Max (approved original artwork)");
        Assert.IsNotNull(receiver, "MaxBridgeDemo must contain the bridge receiver");
        Assert.IsNotNull(max, "MaxBridgeDemo must contain approved Max");
        Assert.IsTrue(Array.Exists(receiver.GetComponents<MonoBehaviour>(), component => component != null && component.GetType().Name == "BrightTalesBridgeV0" && component.isActiveAndEnabled));
        Assert.IsTrue(Array.Exists(max.GetComponents<MonoBehaviour>(), component => component != null && component.GetType().Name == "MaxBridgeCharacter" && component.isActiveAndEnabled));
        var eyes = max.transform.Find("Brightling Life V2 eyelids").GetComponent<SpriteRenderer>();
        Assert.IsNotNull(eyes);
        Assert.IsFalse(eyes.enabled);
        var camera = Camera.main;
        Assert.IsNotNull(camera);
        var root = Directory.GetParent(Application.dataPath).FullName;
        Capture(camera, Path.Combine(root, "fix-open.png"));
        File.WriteAllText(Path.Combine(root, "fix-ready.txt"), "ready");

        var closedCount = 0;
        var reopenedCount = 0;
        var wasClosed = false;
        var start = Time.realtimeSinceStartup;
        while (Time.realtimeSinceStartup - start < 60 && reopenedCount < 2)
        {
            yield return null;
            if (eyes.enabled && !wasClosed)
            {
                closedCount++;
                wasClosed = true;
                Capture(camera, Path.Combine(root, "fix-closed-" + closedCount + ".png"));
            }
            else if (!eyes.enabled && wasClosed)
            {
                reopenedCount++;
                wasClosed = false;
                Capture(camera, Path.Combine(root, "fix-reopened-" + reopenedCount + ".png"));
            }
        }
        Assert.AreEqual(2, closedCount, "Two blink commands should close Max's eyes twice");
        Assert.AreEqual(2, reopenedCount, "Both blinks should return to open eyes");
        Assert.IsFalse(eyes.enabled);
        File.WriteAllText(Path.Combine(root, "fix-complete.txt"), "two blinks reopened");
        yield return new WaitForSecondsRealtime(3f); // Leave the scene alive for reconnect/Pong verification.
    }
}
