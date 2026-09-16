package model

import "testing"

func TestDramaShotDialogueSpeakers(t *testing.T) {
	for _, test := range []struct {
		name string
		shot DramaShot
		want []string
	}{
		{"labelled dialogue", DramaShot{Speaker: "双人同镜", Dialogue: "祁野：别走。\n秦素: 我不会走。\n祁野：等一等。"}, []string{"祁野", "秦素"}},
		{"bracketed label", DramaShot{Speaker: "旁白", Dialogue: "【旁白】：夜色落下。"}, []string{"旁白"}},
		{"legacy fallback", DramaShot{Speaker: "祁野", Dialogue: "别走。"}, []string{"祁野"}},
		{"empty dialogue", DramaShot{Speaker: "祁野"}, nil},
	} {
		t.Run(test.name, func(t *testing.T) {
			got := DramaShotDialogueSpeakers(test.shot)
			if len(got) != len(test.want) {
				t.Fatalf("speakers = %#v, want %#v", got, test.want)
			}
			for index := range got {
				if got[index] != test.want[index] {
					t.Fatalf("speakers = %#v, want %#v", got, test.want)
				}
			}
		})
	}
}
