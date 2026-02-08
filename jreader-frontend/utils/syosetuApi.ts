export interface SyosetuApiResponse {
  allcount: number;
  title: string;
  ncode: string;
  userid: number;
  writer: string;
  story: string;
  biggenre: number;
  genre: number;
  gensaku: string;
  keyword: string;
  general_firstup: string;
  general_lastup: string;
  novel_type: number;
  end: number;
  general_all_no: number;
  length: number;
  time: number;
  isstop: number;
  isr15: number;
  isbl: number;
  isgl: number;
  iszankoku: number;
  istensei: number;
  istenni: number;
  global_point: number;
  daily_point: number;
  weekly_point: number;
  monthly_point: number;
  quarter_point: number;
  yearly_point: number;
  fav_novel_cnt: number;
  impression_cnt: number;
  review_cnt: number;
  all_point: number;
  all_hyoka_cnt: number;
  sasie_cnt: number;
  kaiwaritu: number;
  novelupdated_at: string;
  updated_at: string;
}

export interface SyosetuApiResult {
  allcount: number;
  novel: SyosetuApiResponse;
}

export async function fetchSyosetuMetadata(ncode: string): Promise<SyosetuApiResponse | null> {
  try {
    const apiUrl = `/api/syosetu-metadata?ncode=${encodeURIComponent(ncode)}`;
    console.log('Fetching Syosetu metadata from API:', apiUrl);
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.warn('Failed to fetch Syosetu metadata:', response.status);
      return null;
    }
    
    const data = await response.json();
    if (data && data.title) {
      console.log('Successfully fetched Syosetu metadata:', {
        title: data.title,
        ncode: data.ncode
      });
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Syosetu metadata:', error);
    return null;
  }
}
