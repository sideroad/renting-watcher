export const URLS = [
    // SUUMO URLs
    'https://suumo.jp/jj/chintai/ichiran/FR301FC005/?mt=9999999&cn=9999999&ra=013&et=15&tc=0400101&tc=0400908&tc=0401102&shkr1=03&ar=030&bs=040&ct=35.0&shkr3=03&shkr2=03&mb=65&sngz=&rn=0265&rn=0280&shkr4=03&cb=0.0&ts=1&ts=2',
    'https://suumo.jp/jj/chintai/ichiran/FR301FC005/?fw2=&ek=030525620&ek=030510270&ek=030506970&ek=030520470&ek=030501820&ek=030502980&ek=030541160&ek=030517470&ek=030521520&ek=030541280&ek=030519670&ek=030505600&ek=030532110&ek=030527280&ek=030513930&ek=030500640&ek=030506640&ek=030528500&ek=030511640&ek=030536880&ek=030538740&ek=030531920&ek=030538710&ek=030514690&ek=030528740&ek=030512780&ek=030523100&mt=9999999&cn=9999999&ra=013&et=15&tc=0400101&tc=0400908&tc=0401102&shkr1=03&ar=030&bs=040&ct=35.0&shkr3=03&shkr2=03&mb=65&rn=0305&shkr4=03&cb=0.0&ts=1&ts=2',

    // Nifty URLs
    'https://myhome.nifty.com/rent/tokyo/koenji_st/?lines=tokyo:chuohonsen&stations=tokyo:asagaya,tokyo:higashikoganei,tokyo:hino,tokyo:kichijoji,tokyo:kokubunji,tokyo:kunitachi,tokyo:mitaka,tokyo:musashikoganei,tokyo:musashisakai,tokyo:nishikokubunji,tokyo:nishiogikubo,tokyo:ogikubo,tokyo:tachikawa&r2=300000&r20=1,2&r6=15&r10=65&ex3=1&floors2=1&ex21=1&sort=recommend',

    // Goodrooms URLs
    'https://www.goodrooms.jp/tokyo/search/commuting_time_list/?required_condition=is_more_than_second_floor-is_more_than_second_floor-has_roof_balcony-pets_allowed&construction=rebar&building_type=mansion&upper_minute=40&transfer_count=&commuting_stations=%E6%96%B0%E5%AE%BF&walk_minutes=15&rent_select=1&is_contain_full=0&rental_fee=-300000&room_space=70-',
];

export function getSlackWebhookUrl(): string {
    return process.env.SLACK_WEBHOOK_URL || '';
}

export function getSupabaseUrl(): string {
    return process.env.SUPABASE_URL || '';
}

export function getSupabaseAnonKey(): string {
    return process.env.SUPABASE_ANON_KEY || '';
}