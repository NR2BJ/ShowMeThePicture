/** 필름 스트립 한 칸. src 가 null 이면 빈 프레임(사진 없음). */
export type Frame = { id: string; src: string | null; label: string; num: string };

export type StripRow = {
	frames: Frame[];
	/** 한 바퀴 도는 데 걸리는 초 */
	dur: number;
	/** 기울기(deg). 줄마다 부호를 바꿔 S자 느낌 */
	tilt: number;
	dir: 'left' | 'right';
};
