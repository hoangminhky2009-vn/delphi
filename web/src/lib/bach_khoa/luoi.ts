/**
 * BỘ ICON PIXEL CỦA BÁCH KHOA (D334) — 47 lưới 16×16, vẽ bằng `PixelLuoi` (cùng bảng màu, cùng
 * cách đổ bóng với `PixelIcon`). Nằm trong chunk nạp trễ của màn bách khoa, không vào gói mọi người chơi tải.
 *
 * Founder 14/09: *"mấy cái icon mặc định hiện tại cũng khá hợp để làm miêu tả, chỉ là cho nó tý màu sắc và
 * cách điệu lại pixel"* — nên mỗi lưới giữ Ý của ký tự cũ trong demo (≋ sóng, ⚖ cân…), màu theo vật thật.
 * Nguồn vẽ: docs/ui-ux/demo/bach-khoa/pixel-*.js (demo A11.25). Icon đã có trong `PixelIcon` thì dùng lại,
 * không vẽ bản thứ hai — xem `ICON_DUNG_LAI` ở index.ts.
 * ⚠ SINH TỪ DEMO bằng script một lần ngày 14/09; sửa lưới thì sửa ở ĐÂY (demo không còn là nguồn sau khi thi công).
 */
export const LUOI_BACH_KHOA: Readonly<Record<string, readonly string[]>> = {
  crypto: [
    '................', '.....yyyyyy.....', '...yyOOOOOOoo...', '..yOOOWOWOOOOo..',
    '..yOOWWWWWOOOo..', '.yOOOWOOOOWOOOo.', '.yOOOWOOOOWOOOo.', '.yOOOWWWWWOOOOo.',
    '.yOOOWOOOOWOOOo.', '.yOOOWOOOOWOOOo.', '.yOOOWOOOOWOOOo.', '..yOOWWWWWOOOo..',
    '..oOOOWOWOOOOo..', '...ooOOOOOOoo...', '.....oooooo.....', '................',
  ],
  bang_dien: [
    '................', '................', '.SSSSSSSSSSSSSs.', '.Skkkkkkkkkkkkx.',
    '.SkSSkGGGkGGGkx.', '.Skkkkkkkkkkkkx.', '.SkSSkqqqkqqqkx.', '.Skkkkkkkkkkkkx.',
    '.SkSSkGGGkGGGkx.', '.Skkkkkkkkkkkkx.', '.xxxxxxxxxxxxxx.', '......xssx......',
    '....ssssssss....', '................', '................', '................',
  ],
  ro30: [
    '................', '................', '.......vvu......', '...LLl.vvu......',
    '...LLl.vvu.SSs..', '...Lll.vuu.Sss..', '.TTTTTTTTTTTTTT.', '.bTTTTTTTTTTTTb.',
    '..TbTbTbTbTbTb..', '..bTbTbTbTbTbT..', '..TbTbTbTbTbTb..', '...bTbTbTbTbT...',
    '...TbTbTbTbTb...', '....BBBBBBBB....', '................', '................',
  ],
  vang: [
    '................', '................', '................', '................',
    '....JJJJJJJJ....', '...JYYYYYYYYJ...', '..JYYYYYYYYYYy..', '.JJJJJJJJJJJJJy.',
    '.yyWyyyyyyyyyyo.', '.yyyyyyyyyyyyyo.', '.yyyyyyyyyyyyyo.', '.oooooooooooooo.',
    '................', '................', '................', '................',
  ],
  usdt: [
    '................', '.....WWWWWW.....', '...WWSSSSSSss...', '..WSSSSSSSSSSs..',
    '..WSSllllllSSs..', '.WSSSSSllSSSSSs.', '.WSSSSSllSSSSSs.', '.WSSSllllllSSSs.',
    '.WSSSSSllSSSSSs.', '.WSSSSSllSSSSSs.', '.sSSSSSllSSSSSs.', '..sSSSSaaSSSSs..',
    '..sSSSSSSSSSSs..', '...ssSSSSSSss...', '.....ssssss.....', '................',
  ],
  trai_phieu: [
    '................', '................', '.WWWWWWWWW......', '.WSSSSSSSx.yyyy.',
    '.WSxxxxxSx.yJJo.', '.WSSSSSSSx.oooo.', '.WSxxxxSSx......', '.WSSSSSSSx.yyyy.',
    '.WSxxxxxSx.yJJo.', '.WSSSSSSSx.oooo.', '.WSSSSSllx......', '.WSSSSlLlx.yyyy.',
    '.WSSSSSllx.yJJo.', '.xxxxxxxxx.oooo.', '................', '................',
  ],
  song: [
    '................', '................', 'WW......WW......', 'LLA....ALLA....A',
    '..LA..AL..LA..AL', '...LAAL....LAAL.', '....ll......ll..', '................',
    'AA......AA......', 'llL....LllL....L', '..lL..Ll..lL..Ll', '...lLLl....lLLl.',
    '....aa......aa..', '................', '................', '................',
  ],
  bat_day: [
    '................', '.............G..', '............GGG.', '..qQ.......GGGGG',
    '..qQ........Gn..', '...qQ......Gn...', '...qQ......Gn...', '....qQ....Gn....',
    '....qQ....Gn....', '.....qQ..Gn.....', '.....qQ..Gn.....', '......qQGn......',
    '......qQGn......', '.......SS.......', '.......ss.......', '................',
  ],
  ten_lua: [
    '................', '.......SS.......', '......SSSs......', '......SAls......',
    '......SlLs......', '......SSSs......', '......SSSs......', '.....uSSSsu.....',
    '....uuSSSsuu....', '....uu.OO.uu....', '......OJJO......', '.......JO.......',
    '.......O........', '................', '................', '................',
  ],
  chan_lo: [
    '................', '.......qQ.......', '.......qQ.......', '.......qQ.......',
    '.......qQ.......', '.......qQ.......', '.......qQ.......', '....qqqqqqqQ....',
    '.....qqqqqQ.....', '......qqqQ......', '.......qQ.......', '....W......W....',
    '..WWWWWWWWWWWW..', '..SSSSSSSSSSSs..', '..ssssssssssss..', '................',
  ],
  o_du: [
    '................', '........W.......', '......vvvvv.....', '....vvVvvvvvu...',
    '...vVvvvvvvvvu..', '..vVvvvvvvvvvvu.', '..vvvvvvvvvvvvu.', '..uuu..uuu..uuu.',
    '........s.......', '........s.......', '........s.......', '........s.......',
    '........s.......', '.....s..s.......', '......ss........', '................',
  ],
  don_bay: [
    '................', '..........JJJJ..', '..........yyyo..', '..........JJJJ..',
    '..........yyyo..', '..........JJJJ..', '..........yyyo..', '..JJ......TTTTT.',
    '..yo..TTTTbbbbb.', '..TTTTbbbb......', '..bbbb...s......', '........sss.....',
    '.......sssss....', '......xxxxxxx...', '................', '................',
  ],
  ban_khong: [
    '................', '................', '................', '..qq............',
    '...qq...........', '....qq..........', '.....qq.........', '......qq........',
    '.......qq...qQ..', '........qq..qQ..', '.........qq.qQ..', '..........qqqQ..',
    '.........qqqqQ..', '........QQQQQQ..', '................', '................',
  ],
  tua_nhanh: [
    '................', '................', '................', '...A.....A......',
    '...AL....AL.....', 'ss.LLL...LLL....', '...LLLL..LLLL...', 'ss.LLLLL.LLLLL..',
    '...lllll.lllll..', '...llll..llll...', 'ss.lll...lll....', '...ll....ll.....',
    '...l.....l......', '................', '................', '................',
  ],
  chia_lenh: [
    '................', '................', '..VVVVVVVVVVVV..', '..vvvvvvvvvvvu..',
    '..uuuuuuuuuuuu..', '................', '.......ss.......', '.....ssssss.....',
    '......ssss......', '.......ss.......', '................', '.VV..VV..VV..VV.',
    '.vu..vu..vu..vu.', '.uu..uu..uu..uu.', '................', '................',
  ],
  gio_trung: [
    '................', '................', '................', '................',
    '..WW...HH...AA..', '.WSSs.HPPp.ALLl.', '.WSSs.HPPp.ALLl.', '.SSss.PPpp.LLll.',
    '.TTTT.TTTT.TTTT.', '.bTbT.bTbT.bTbT.', '.TbTb.TbTb.TbTb.', '..BB...BB...BB..',
    '................', '................', '................', '................',
  ],
  di_nguoc: [
    '................', '...s....s....s..', '.ssss.ssss.ssss.', '...s....s....s..',
    '................', '.....s....s.....', '...ssss.ssss....', '.....s....s.....',
    '................', '.....v..........', '....vv..........', '..VVVVVVVVVVVV..',
    '..uuuuuuuuuuuu..', '....uu..........', '.....u..........', '................',
  ],
  la_vai: [
    '................', '................', '....SSSSSSSS....', '.uuuSWWWWWWsuuu.',
    '.uvuSWWllWWsuvu.', '.uuuSWWllWWsuuu.', '.uvuSWllllWsuvu.', '.uuuSWllllWsuuu.',
    '.uvuSWWWWWWsuvu.', '.uuuSWWWWWWsuuu.', '.uvuSWWWWWWsuvu.', '.wwwSWWWWWWswww.',
    '....ssssssss....', '................', '................', '................',
  ],
  bac_gia: [
    '................', '................', '..WWWWWW........', '..SSSSSs........',
    '................', '..qqqqqqqq......', '..QQQQQQQQ......', '................',
    '..qqqqqqqqqq....', '..QQQQQQQQQQ....', '................', '..qqqqqqqqqqqq..',
    '..QQQQQQQQQQQQ..', '................', '................', '................',
  ],
  giot_nuoc: [
    '................', '.......LL.......', '.......LL.......', '......LAAL......',
    '......LALl......', '.....LAALLl.....', '.....LALLLl.....', '....LAALLLLl....',
    '....LALLLLLl....', '...LWALLLLLLl...', '...LALLLLLLLl...', '...LLLLLLLLLl...',
    '...lLLLLLLLll...', '....lLLLLLLl....', '.....llllll.....', '................',
  ],
  dam_dong: [
    '................', '................', '................', '................',
    '.ss..ss..ss..ss.', '.ss..ss..ss..ss.', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx',
    'xxxSSxxSSxxSSxxx', 'xxxSSxxSSxxSSxxx', '..vvvvPPPPLLLL..', '..vvvvPPPPLLLL..',
    '..uuuuppppllll..', '................', '................', '................',
  ],
  ban_thao: [
    '................', '.......O........', '...O..OOO..O....', '....OOOOOOO.....',
    '...OOOOOOOOO....', '..OOWWOOOOWOO...', '..OOWWOOOWOOO...', '.OOOOOOOWOOOOOO.',
    '..OOOOOWOOOOO...', '..OOOOWOOWWOO...', '...OOWOOOWWOO...', '...OOOOOOOOO....',
    '....OOOOOOO.....', '...o..ooo..o....', '.......o........', '................',
  ],
  chu_ky: [
    '................', '................', '................', '................',
    '....WWW.........', '...GSSSq........', '..Gn...Qq.......', '.Gn.....Qq......',
    'Gn.......Qq.....', 'n.........Qq...G', '...........Qsssn', '............xxx.',
    '................', '................', '................', '................',
  ],
  tin_gia: [
    '................', '................', '................', '..WWWWWWWWWWWW..',
    '..Wppppppppppx..', '..WSSSSSSSSSSx..', '..WxxxxxxSSSSx..', '..WSSSSSSSSSSx..',
    '..WxxxxxxxxSSx..', '..WSSSPPPSPPPx..', '..WxxPhhPPPhhP..', '..WSSSpppSpppx..',
    '..xxxxxxxxxxxx..', '................', '................', '................',
  ],
  ong_gio: [
    '................', '................', '..S.............', '..xOOWW.........',
    '..xOOWWOOWW.AAA.', '..xOOWWOOWWOOW..', '..xooSSooSS..AA.', '..xooSS.........',
    '..x...AAAAA.....', '..x.............', '..x.............', '..x.............',
    '..x.............', '.sxs............', '................', '................',
  ],
  domino: [
    '................', '................', '................', '................',
    '................', '.SSs...SSs......', '.SSs...SxS......', '.SxS..SSs.......',
    '.SSs..SSs.......', '.SSs..SxS.......', '.SxS.SSs........', '.SSs.SSs..OOOOOo',
    '.SSs.SxS..OkOkOo', '.sss.sss..oooooo', '................', '................',
  ],
  dong_ho_ap: [
    '................', '................', '................', '................',
    '.....ssssss.....', '...xxssssssOO...', '..xx......W.OO..', '.xx......W...OO.',
    '.xx.....W....OO.', '.xx....WW....OO.', '.xxxxxxxxxxxxxx.', '................',
    '................', '................', '................', '................',
  ],
  vong_lap: [
    '................', '................', '.....vvvv...VV..', '...vvvvvv..VVVV.',
    '..vvvv....VVVVVV', '..vvv......vvv..', '.vvv........vvv.', '.vvv........vvv.',
    '.vvv........vvv.', '.vvv........vvv.', '..vvv......uuu..', '..vvvv....uuuu..',
    '...vvvvvuuuuu...', '.....vvuuuu.....', '................', '................',
  ],
  can_lai: [
    '................', '.......WW.......', '.......ss.......', '.ssssssssssssss.',
    '.s.....ss.....s.', 's.s....ss....s.s', 's.s....ss....s.s', 'JJJJ...ss...WWWW',
    '.yy....ss....SS.', '.......ss.......', '.......ss.......', '.....ssssss.....',
    '....xxxxxxxx....', '................', '................', '................',
  ],
  xu_chay: [
    '................', '................', '.....JJJJJJ.....', '...JJyyyyyyoo...',
    '..JyyYYyyyyyyo..', '..Jyyyyyyyyyyo..', '.Jyyyyyyyyyyyyo.', '.Jyyyyyyyyyyyyo.',
    '.oyyyyyyyyyyyyo.', '..oyyoyyyyoyyo..', '..oyo.oyyo.oyo..', '...y..oyyo...o..',
    '...o...yy.......', '.......oo.......', '..y.............', '................',
  ],
  dong_ho_cat: [
    '................', '..TTTTTTTTTTTT..', '...A........A...', '....AJJJJJJA....',
    '.....AJJJJA.....', '......AJJA......', '.......JJ.......', '.......Jy.......',
    '......A.yA......', '.....A..y.A.....', '....A..yyy.A....', '...A.yyyyyy.A...',
    '...AyyyyyyyyA...', '..TTTTTTTTTTTT..', '..bbbbbbbbbbbb..', '................',
  ],
  duong_cong: [
    '................', '................', '..x.............', '..x.............',
    '..xWW...........', '..x..WW....s.s..', '..x....WWs......', '..x....s.WW.....',
    '..x..s.....WW...', '..x..........W..', '..xs............', '..x.............',
    '..xxxxxxxxxxxxx.', '................', '................', '................',
  ],
  dien_thoai: [
    '................', '................', '................', 'W..............W',
    '.W............W.', '..OOOOOOOOOOOO..', '.OOooooooooooOO.', '.OO..........OO.',
    '....SSSSSSSS....', '...SSxSSxSSxS...', '..SSSSSSSSSSSS..', '..SSxSSxSSxSSs..',
    '..SSSSSSSSSSSs..', '..ssssssssssss..', '................', '................',
  ],
  ot: [
    '................', '............g...', '...........gn...', '.........qqqn...',
    '........qqqqQ...', '.......qRqqqQ...', '......qRqqqQ....', '.....qqqqqQ.....',
    '....qqqqqQ......', '...qqqqqQ.......', '..qqqqQ.........', '.qqqQ...........',
    '.qQ.............', '..Q.............', '................', '................',
  ],
  ngam: [
    '................', '.......SS.......', '.....LLSSLL.....', '...LL..SS..LL...',
    '..L....SS....L..', '..L..........L..', '.L............L.', 'SSSS...WW...SSSS',
    'SSSS...WW...SSSS', '.L............L.', '..L..........L..', '..L....SS....L..',
    '...LL..SS..LL...', '.....LLSSLL.....', '.......SS.......', '................',
  ],
  tb_ha_lai: [
    '................', '................', '................', '................',
    '.WWW...WW...vu..', '.W.W..WW....vu..', '.WWW.WW.....vu..', '....WW......vu..',
    '...WW.......vu..', '..WW.WWW....vu..', '.WW..W.W..vvvvuu', 'WW...WWW...vvvu.',
    '............vu..', '................', '................', '................',
  ],
  tb_tang_lai: [
    '................', '................', '................', '................',
    '.WWW...WW...vu..', '.W.W..WW...vvvu.', '.WWW.WW...vvvvuu', '....WW......vu..',
    '...WW.......vu..', '..WW.WWW....vu..', '.WW..W.W....vu..', 'WW...WWW....vu..',
    '............vu..', '................', '................', '................',
  ],
  tb_sap_san: [
    '................', '.....yyy........', '...yyOO...yy....', '..yOOOOO.OOOoo..',
    '..yOOOO...OOOOo.', '.yOOOOOO.OOOOOo.', '.yOOOOO...OOOOOo', '.yOOOOOO.OOOOOOo',
    '.yOOOOO...OOOOOo', '.yOOOOOO.OOOOOOo', '.yOOOOO...OOOOOo', '..oOOOOO.OOOOOOo',
    '..oOOOO...OOOOo.', '...ooOOO.OOOOOo.', '.....oo...OOoo..', '.........ooo....',
  ],
  tb_lam_phat: [
    '................', '.......SS.......', '......S..s......', '......S..s.W....',
    '......SOOs......', '......SOOs.W....', '......SOOs......', '......SOOs.W....',
    '......SOOs......', '......SOOs......', '.....SOOOOs.....', '....SOOYOOOs....',
    '....SOOOOOOs....', '....sOOOOOOs....', '.....ssssss.....', '................',
  ],
  tb_chien_tranh: [
    '................', '.W............W.', '..S..........S..', '...S........S...',
    '....S......S....', '.....S....S.....', '......S..S......', '.......SS.......',
    '.......SS.......', '....b.S..S.b....', '.....S....S.....', '....b.b..b.b....',
    '...b........b...', '..y..........y..', '................', '................',
  ],
  tb_bong_bong: [
    '................', '................', '...........AA...', '..........AW.A..',
    '....AAAA..A..L..', '...A.WW.A..LL...', '..A.W....A......', '..A......L......',
    '..A......L......', '..A......L......', '...L....L.......', '....LLLL........',
    '............AW..', '............LL..', '................', '................',
  ],
  tb_phap_ly: [
    '................', '................', '................', '....TTTTTTTTT...',
    '...BTTTTTTTTTB..', '...BbbbbbbbbbB..', '....bbbbbbbbb...', '.......bb.......',
    '........bb......', '.........bb.....', '..........bb....', '..xxxxxxx..bb...',
    '.xsssssssx......', '.xxxxxxxxx......', '................', '................',
  ],
  tb_pha_san: [
    '................', '.......S........', '......SSS.......', '.....SSkSS......',
    '....SSSSkSS.....', '...SSSSSkSSS....', '..SSSSSkSSSSS...', '..s....k....s...',
    '..s.x.xk.x.xs...', '..s.x.x.kx.xs...', '..s.x.xk.x.xs...', '..s.x.x.kx.xs...',
    '..s.x.xk.x.xs...', '..sssssksssss...', '.xxxxxxkxxxxxx..', '................',
  ],
  tb_cam_van: [
    '................', '................', '................', '................',
    '..TTTTTTTTTTTT..', '..TBBBBBBBBBBT..', '..TTTTS..STTTT..', '..TBBBS..SBBBT..',
    'sSsSsWWWWWWsSsSs', 'SsSsSWSSSSWSsSsS', '..TBBWSkkSWBBT..', '..TTTWSSSSWTTT..',
    '..TBBssssssBBT..', '..BBBBBBBBBBBB..', '................', '................',
  ],
  tb_tham_hoa: [
    '................', '................', '.ssssssssssssss.', '..xxxxxxxxxxxx..',
    '...ssssssssss...', '....xxxxxxxxx...', '.....ssssssss.b.', '.....xxxxxx.....',
    '......ssssss....', '..b....xxxx.....', '.......sss......', '........xx......',
    '.......ss.......', '........s.......', '................', '................',
  ],
  tb_dich_benh: [
    '................', '.......pp.......', '..p....PP....p..', '...P..PPPP..P...',
    '....PPHHPPPP....', '....PHHPPPPp....', '...PPHPPhPPpp...', 'ppPPPPPPPPPPPPpp',
    'ppPPPhPPPPPPPPpp', '...PPPPPPhPPpp..', '....PPPPPPPp....', '....pPPPPPPp....',
    '...p..pppp..p...', '..p....pp....p..', '.......pp.......', '................',
  ],
  thien_nga: [
    '................', '................', '....xW..........', '...Oxxx.........',
    '.....xx.........', '......x.........', '......x.........', '.....xx.........',
    '.....xxxxxxxx.x.', '....xxxxxxxxxxx.', '....xxxxxxxxxxx.', '.....zzzzzzzzz..',
    '..aaaaaaaaaaaa..', '................', '................', '................',
  ],
};
