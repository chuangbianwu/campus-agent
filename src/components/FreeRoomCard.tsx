/**
 * 空闲教室卡片组件（生成式 UI）
 *
 * Agent 多轮工具链的第二环：查完课表发现没课 → 查空闲教室 → 渲染这张卡。
 * 视觉纪律：课程卡片是全场唯一的"重"元素（琥珀微光），
 * 这张卡刻意安静——普通面板 + 绿灯"空闲"标记，不抢戏。
 */

export interface FreeRoom {
  building: string;    // 楼栋，如"教学楼三"
  room: string;        // 房间，如"301"
  capacity: number;    // 容量
  facilities: string[]; // 设施标签
  freePeriods: string[]; // 当天空闲时段
}

export interface FreeRoomCardData {
  day: string;      // 星期几
  period: string;   // 查询时段（上午/下午/晚上/全天）
  rooms: FreeRoom[];
}

function FreeRoomCard({ data }: { data: FreeRoomCardData }) {
  return (
    <div className="room-card">
      <div className="room-card-header">
        <span>{data.day} · {data.period}空闲场所</span>
        <span className="room-card-count">{data.rooms.length} 处</span>
      </div>
      <div className="room-card-body">
        {data.rooms.map((r, i) => (
          <div key={i} className="room-item">
            <span className="room-dot" />
            <div className="room-info">
              <div className="room-name-row">
                <span className="room-name">{r.building} · {r.room}</span>
                <span className="room-cap">{r.capacity} 座</span>
              </div>
              <div className="room-meta">
                空闲：{r.freePeriods.join(' / ')} · {r.facilities.join(' · ')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FreeRoomCard;
