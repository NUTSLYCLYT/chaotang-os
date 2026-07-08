#!/usr/bin/env python3
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "mcp_servers"))
from base_server import BaseServer

class WeatherServer(BaseServer):
    def __init__(self):
        super().__init__(name="weather", version="1.0")
    def register_tools(self):
        self.add_tool("get_weather", "查询当前天气", {"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}, self.get_weather)
        self.add_tool("get_weather_forecast", "查询天气预报", {"type":"object","properties":{"city":{"type":"string"},"days":{"type":"integer","default":3}},"required":["city"]}, self.get_weather_forecast)
    def get_weather(self, city):
        return {"北京":{"temp":18,"condition":"晴"},"呼和浩特":{"temp":-5,"condition":"极寒"}}.get(city, {"temp":15,"condition":"默认"})
    def get_weather_forecast(self, city, days=3):
        return [{"day":i+1,"city":city,"temp_high":15+i,"temp_low":5+i} for i in range(days)]

if __name__ == "__main__":
    WeatherServer().run()
