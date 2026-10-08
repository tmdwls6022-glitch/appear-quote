"""모의 견적 한 회차를 끝까지 돌리고 점수를 출력한다. jin 10/5

  QUOTE_USER_KEY=<승인된 직원 user_key> python3 tests/run_mock.py [새로]

카톡 채널에서 "모의"를 여러 번 보내는 것과 같다(kakao-quote 에 카카오 형식으로 POST).
시트에는 아무것도 쓰지 않는다. 결과는 Supabase quote_test_runs 에 남는다.
"""
import json
import os
import sys
import time
import urllib.request

URL = "https://ykujzljgaxtbwawuwoff.supabase.co/functions/v1/kakao-quote"
KEY = os.environ["QUOTE_USER_KEY"]


def say(text):
    body = json.dumps({"userRequest": {"user": {"id": KEY}, "utterance": text}}).encode()
    req = urllib.request.Request(URL, body, {"Content-Type": "application/json"})
    out = json.loads(urllib.request.urlopen(req, timeout=120).read())
    return out["template"]["outputs"][0]["simpleText"]["text"]


def main():
    first = "모의 새로" if "새로" in sys.argv[1:] else "모의"
    print(say(first))
    while True:
        time.sleep(20)
        res = say("모의결과")
        if "돌리는 중" in res:
            print(res.splitlines()[1])
            continue
        if "남은 사례" in res:
            print(say("모의"))
            continue
        print(res)
        break


if __name__ == "__main__":
    main()
