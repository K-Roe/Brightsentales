using System;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class MaxBridgeProtocolTest
{
    private static MethodInfo Method(Type type, string name) => type.GetMethod(name, BindingFlags.Instance | BindingFlags.NonPublic);
    private static int Request(string path, string body = null)
    {
        var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:17843" + path);
        request.Timeout = 3000;
        request.Headers["Origin"] = "http://127.0.0.1:5174";
        if (body != null)
        {
            request.Method = "POST";
            request.ContentType = "application/json";
            var bytes = Encoding.UTF8.GetBytes(body);
            request.ContentLength = bytes.Length;
            using (var stream = request.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);
        }
        try { using (var response = (HttpWebResponse)request.GetResponse()) return (int)response.StatusCode; }
        catch (WebException error) { using (var response = (HttpWebResponse)error.Response) return (int)response.StatusCode; }
    }
    private static void Expect(int actual, int wanted) { if (actual != wanted) throw new Exception("Expected HTTP " + wanted + ", got " + actual); }
    private static void Pump(BrightTalesBridgeV0 bridge, Task task)
    {
        var until = DateTime.UtcNow.AddSeconds(3);
        while (!task.IsCompleted && DateTime.UtcNow < until)
        {
            Method(typeof(BrightTalesBridgeV0), "Update").Invoke(bridge, null);
            Thread.Sleep(5);
        }
        if (!task.IsCompleted) throw new Exception("Command did not finish");
    }
    public static void Run()
    {
        EditorSceneManager.OpenScene("Assets/Scenes/MaxBridgeDemo.unity");
        var bridge = UnityEngine.Object.FindAnyObjectByType<BrightTalesBridgeV0>();
        var max = UnityEngine.Object.FindAnyObjectByType<MaxBridgeCharacter>();
        var eyes = max.transform.Find("Brightling Life V2 eyelids").GetComponent<SpriteRenderer>();
        Method(typeof(BrightTalesBridgeV0), "Awake").Invoke(bridge, null);
        Expect(Request("/health"), 200);
        Expect(Request("/ping"), 200);
        Expect(Request("/command", "{\"command\":\"max.unknown\"}"), 404);
        Expect(Request("/command", "{\"bad\":true}"), 400);
        var first = Task.Run(() => Request("/command", "{\"command\":\"max.blink\"}"));
        Pump(bridge, first);
        Expect(first.Result, 202);
        if (!eyes.enabled) throw new Exception("Accepted blink did not close eyes");
        var repeated = Task.Run(() => Request("/command", "{\"command\":\"max.blink\"}"));
        Pump(bridge, repeated);
        Expect(repeated.Result, 409);
        Thread.Sleep(180);
        Method(typeof(MaxBridgeCharacter), "Update").Invoke(max, null);
        if (eyes.enabled) throw new Exception("Eyes did not reopen");
        max.gameObject.SetActive(false);
        var unavailable = Task.Run(() => Request("/command", "{\"command\":\"max.blink\"}"));
        Pump(bridge, unavailable);
        Expect(unavailable.Result, 503);
        Method(typeof(BrightTalesBridgeV0), "OnDestroy").Invoke(bridge, null);
        Debug.Log("MAX_BRIDGE_PROTOCOL_TEST_PASS health=200 ping=200 unknown=404 malformed=400 accepted=202 busy=409 unavailable=503 reopened=true");
    }
}
